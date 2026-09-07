import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import { getAdminChatEmailTemplates } from "./admin-chat-template.js";

// ==========================================
// ENVIRONMENT MATRIX
// ==========================================
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    throw new Error("CRITICAL SYSTEM CONFIGURATION FAULT: Environment matrix variables missing.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
});

function applyCors(req, res) {
    const origin = req.headers.origin;

    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, X-Action, X-Action-Phase, X-Transaction-Pin, X-User-UUID, X-Setting-Target, x-setting-target");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return true;
    }
    return false;
}

function formatPlatformName(signature) {
    if (!signature || typeof signature !== "string") return "Platform";
    const cleanStr = signature.trim();
    return cleanStr.charAt(0).toUpperCase() + cleanStr.slice(1);
}

async function getAdminEmailConfig(signature) {
    const { data: adminRecord, error } = await supabase
        .from("admin_2")
        .select("api, domain_email, contact_email, email")
        .eq("signature", signature)
        .maybeSingle();

    if (error || !adminRecord) {
        throw new Error(error ? error.message : `Failed to fetch email settings from admin_2 for signature: "${signature}"`);
    }

    if (!adminRecord.api?.trim()) {
        throw new Error("Missing Brevo API key in admin_2 configuration.");
    }

    const senderEmail = (adminRecord.domain_email || adminRecord.contact_email || adminRecord.email)?.trim();
    if (!senderEmail) {
        throw new Error("Neither domain_email, contact_email, nor email is configured in admin_2 table.");
    }

    return {
        apiKey: adminRecord.api.trim(),
        senderEmail: senderEmail,
        adminContactEmail: adminRecord.email?.trim() || senderEmail
    };
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;

    const authHeader = req.headers.authorization || req.headers.Authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Unauthorized access credentials missing." });
    }

    const token = authHeader.split(" ")[1];
    let decoded = null;

    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
        console.error("❌ TOKEN VERIFICATION CRASH:", jwtErr.message);
        return res.status(401).json({
            success: false,
            error: "Your user login session has expired or token signature is corrupt."
        });
    }

    try {
        const isAdmin = decoded.adminId ? true : false;
        const uuid = req.query.uuid || req.body.user_uuid || decoded.uuid || decoded.id;

        if (!uuid) {
            return res.status(400).json({ success: false, error: "Missing user identification parameters." });
        }

        // ======================================
        // FETCH CHAT STREAM WITH PAGINATION (GET)
        // ======================================
        if (req.method === "GET") {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;

            const fromRangeOffset = (page - 1) * limit;
            const toRangeOffset = fromRangeOffset + limit - 1;

            if (isAdmin) {
                await supabase
                    .from("admin_chats")
                    .update({ is_read: true })
                    .eq("user_uuid", uuid)
                    .eq("sender_role", "user");
            }

            const { data, error } = await supabase
                .from("admin_chats")
                .select("*")
                .eq("user_uuid", uuid)
                .order("created_at", { ascending: false })
                .range(fromRangeOffset, toRangeOffset);

            if (error) throw error;

            const chronologicalOrderedChats = (data || []).reverse();

            return res.status(200).json({
                success: true,
                chats: chronologicalOrderedChats,
                hasMore: (data || []).length === limit
            });
        }

        // ======================================
        // SEND CHAT MESSAGE WITH BREVO MAIL ALERT (POST)
        // ======================================
        if (req.method === "POST") {
            const { message_body, attachment_url } = req.body;

            if (!message_body && !attachment_url) {
                return res.status(400).json({ success: false, error: "Message payload empty." });
            }

            const { data: chatMessageNode, error: chatError } = await supabase
                .from("admin_chats")
                .insert({
                    user_uuid: uuid,
                    sender_role: isAdmin ? "admin" : "user",
                    message_body: message_body || null,
                    attachment_url: attachment_url || null,
                    is_read: false
                })
                .select()
                .single();

            if (chatError) throw chatError;

            // =======================================================
            // BREVO MAILER SYSTEM ROUTING (AWAITED DIRECTLY LIKE LOGIN-USER)
            // =======================================================
            try {
                const { data: userProfile, error: profileErr } = await supabase
                    .from("users")
                    .select("email, firstname, lastname, signature, uuid")
                    .eq("uuid", uuid)
                    .maybeSingle();

                if (profileErr) {
                    console.error("❌ Profile Retrieval Error:", profileErr.message);
                } else if (userProfile) {
                    const { apiKey, senderEmail, adminContactEmail } = await getAdminEmailConfig(userProfile.signature);
                    const brevo = new BrevoClient({ apiKey });
                    const platformName = formatPlatformName(userProfile.signature);

                    const { subject, plainTextBody, htmlEmailTemplate } = getAdminChatEmailTemplates({
                        isAdmin,
                        platformName,
                        userProfile,
                        message_body
                    });

                    const emailRecipientTarget = isAdmin ? userProfile.email.trim() : adminContactEmail;

                    await brevo.transactionalEmails.sendTransacEmail({
                        sender: { name: platformName, email: senderEmail },
                        to: [{ email: emailRecipientTarget }],
                        subject: subject,
                        textContent: plainTextBody,
                        htmlContent: htmlEmailTemplate
                    });

                    console.log("✅ SUCCESS: Brevo chat notification email dispatched.");
                }
            } catch (mailErr) {
                console.warn("⚠️ Brevo email dispatch caught an exception:", mailErr.message);
            }

            return res.status(200).json({ success: true, message: chatMessageNode });
        }

        return res.status(405).json({ success: false, error: "Method not allowed." });

    } catch (err) {
        console.error("ADMIN CHAT API FAILURE:", err);
        return res.status(500).json({ success: false, error: err.message || "Internal server fault." });
    }
}