import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import { getAccountDeactivatedTemplate } from "./data-template.js";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    throw new Error("CRITICAL SYSTEM CONFIGURATION FAULT: Required environment variables are missing.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws }
});

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
        senderEmail: senderEmail
    };
}

export default async function handler(req, res) {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, X-Action, X-Action-Phase, X-Transaction-Pin, X-User-UUID, X-Setting-Target, x-setting-target");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method blocked." });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, error: "Authentication credentials missing." });
        }

        const token = authHeader.split(" ")[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, JWT_SECRET);
        } catch (jwtErr) {
            return res.status(401).json({ success: false, error: "Session expired or invalid token." });
        }

        const { data: userRecord, error: dbError } = await supabase
            .from("users")
            .select("id, uuid, firstname, middlename, lastname, email, accountBalance, accttype, currency, country, image, restricted, accountNumber, activeuser, signature, last_password_change")
            .eq("uuid", decodedToken.uuid)
            .maybeSingle();

        if (dbError || !userRecord) {
            return res.status(444).json({ success: false, error: "Security footprint context mapping anomaly detected." });
        }

        // ==========================================================================
        // TOKEN STAMP SECURITY ALIGNMENT GATEWAY (REVOKES PEER SESSIONS)
        // ==========================================================================
        const tokenPasswordStamp = decodedToken.last_password_change;
        const databasePasswordStamp = userRecord.last_password_change;

        if (databasePasswordStamp && tokenPasswordStamp !== databasePasswordStamp) {
            return res.status(401).json({
                success: false,
                error: "Session Revoked: Your password was recently modified on another active terminal workspace device. Please re-authenticate."
            });
        }

        // Account Deactivation Restriction Loop & Outbound Email Dispatcher
        if (userRecord.activeuser === false) {
            try {
                const dynamicPlatformName = formatPlatformName(userRecord.signature);
                const { apiKey, senderEmail } = await getAdminEmailConfig(userRecord.signature);

                const brevo = new BrevoClient({ apiKey });
                const { subject, textContent, htmlContent } = getAccountDeactivatedTemplate({
                    userRecord,
                    dynamicPlatformName
                });

                await brevo.transactionalEmails.sendTransacEmail({
                    sender: { name: dynamicPlatformName, email: senderEmail },
                    to: [{ email: userRecord.email }],
                    subject: subject,
                    textContent: textContent,
                    htmlContent: htmlContent
                });

                console.log("📨 Dispatched deactivation warning message via Brevo.");
            } catch (mailError) {
                console.warn("⚠️ Account disabled, but Brevo notification failed:", mailError.message);
            }

            return res.status(403).json({
                success: false,
                activeuser: false,
                error: "Access Revoked: This banking profile dashboard has been suspended or deactivated by administration."
            });
        }

        const firstName = userRecord.firstname || "";
        const middleName = userRecord.middlename ? userRecord.middlename.trim() : "";
        const lastName = userRecord.lastname || "";

        const derivedFullName = middleName
            ? `${firstName} ${middleName} ${lastName}`
            : `${firstName} ${lastName}`;

        return res.status(200).json({
            success: true,
            activeuser: true,
            data: {
                uuid: userRecord.uuid,
                fullName: derivedFullName.trim(),
                accountNumber: userRecord.accountNumber,
                accountType: userRecord.accttype,
                currency: userRecord.currency,
                balance: parseFloat(userRecord.accountBalance),
                country: userRecord.country,
                image: userRecord.image || null
            }
        });

    } catch (globalError) {
        console.error("❌ Data retrieval node execution exception:", globalError);
        return res.status(500).json({ success: false, error: globalError.message });
    }
}