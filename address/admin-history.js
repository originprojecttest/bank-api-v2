import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import { generateDebitAlertTemplate, generateCreditAlertTemplate } from "./admin-history-template.js";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    throw new Error("CRITICAL SYSTEM CONFIGURATION FAULT: Required environment variables are missing.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
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

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, error: "Clearance token verification string missing." });
        }
        const token = authHeader.split(" ")[1];
        jwt.verify(token, JWT_SECRET);

        // ==========================================
        // METHOD: GET (FETCH HISTORICAL MATCHES)
        // ==========================================
        if (req.method === "GET") {
            const { uuid, page, limit } = req.query;
            const pageInt = parseInt(page, 10) || 1;
            const limitInt = parseInt(limit, 10) || 10;

            const minRange = (pageInt - 1) * limitInt;
            const maxRange = minRange + limitInt - 1;

            const { data: dbLogs, error: fetchError } = await supabase
                .from("history")
                .select("*")
                .eq("uuid", uuid)
                .order("id", { ascending: false })
                .range(minRange, maxRange);

            if (fetchError) throw fetchError;

            return res.status(200).json({
                success: true,
                logs: dbLogs
            });
        }

        // ==========================================
        // METHOD: POST (APPEND LOG LINE WITH LIVE BREVO ALERT)
        // ==========================================
        if (req.method === "POST") {
            const rowPayload = req.body;

            const shouldDispatchEmailAlert = rowPayload.dispatchEmailAlert === true;
            delete rowPayload.dispatchEmailAlert;

            const { data: insertedData, error: insertError } = await supabase
                .from("history")
                .insert([rowPayload])
                .select()
                .single();

            if (insertError) throw insertError;

            // =============================================================
            // BREVO TRANSACTIONAL EMAIL DISPATCH ENGINE
            // =============================================================
            if (shouldDispatchEmailAlert) {
                try {
                    const { data: userProfile, error: profileErr } = await supabase
                        .from("users")
                        .select("email, firstname, lastname, signature, accountNumber, currency, accountBalance")
                        .eq("uuid", rowPayload.uuid)
                        .maybeSingle();

                    if (profileErr || !userProfile) {
                        throw new Error(profileErr ? profileErr.message : "Target profile context matching target parameters missing inside database.");
                    }

                    const { apiKey, senderEmail } = await getAdminEmailConfig(userProfile.signature);
                    const capitalizedPlatformName = formatPlatformName(userProfile.signature);

                    const brevo = new BrevoClient({ apiKey });

                    const isDebit = rowPayload.transactionType === "Debit";
                    const counterpartDisplayFullName = rowPayload.name || "N/A";
                    const paymentMemo = rowPayload.description || "Account Services Ledger Update";
                    const parsedAmount = Math.abs(parseFloat(rowPayload.amount || "0"));
                    const postBal = rowPayload.current_balance
                        ? parseFloat(rowPayload.current_balance)
                        : parseFloat(userProfile.accountBalance || "0");
                    const currentTimestampString = rowPayload.date || new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

                    let emailSubject = "";
                    let htmlEmailTemplate = "";

                    if (isDebit) {
                        emailSubject = `${capitalizedPlatformName} New Transaction`;
                        htmlEmailTemplate = generateDebitAlertTemplate(
                            capitalizedPlatformName,
                            userProfile,
                            counterpartDisplayFullName,
                            postBal,
                            parsedAmount
                        );
                    } else {
                        emailSubject = `New message notification - ${userProfile.signature || "platform"}`;
                        htmlEmailTemplate = generateCreditAlertTemplate(
                            capitalizedPlatformName,
                            userProfile,
                            counterpartDisplayFullName,
                            postBal,
                            parsedAmount,
                            paymentMemo,
                            currentTimestampString
                        );
                    }

                    await brevo.transactionalEmails.sendTransacEmail({
                        sender: { name: capitalizedPlatformName, email: senderEmail },
                        to: [{ email: userProfile.email.trim() }],
                        subject: emailSubject,
                        htmlContent: htmlEmailTemplate
                    });

                    console.log("✅ Outbound history log update notification resolved via Brevo API.");
                } catch (emailError) {
                    console.error("⚠️ Outbound transaction alert routine exception warning:", emailError.message);
                }
            }

            return res.status(200).json({
                success: true,
                data: insertedData
            });
        }

        // ==========================================
        // METHOD: PUT (UPDATE HISTORY RECORD)
        // ==========================================
        if (req.method === "PUT") {
            const { id } = req.query;
            const fieldMutationObject = req.body;

            const { data: updatedData, error: updateError } = await supabase
                .from("history")
                .update(fieldMutationObject)
                .eq("id", id)
                .select();

            if (updateError) throw updateError;

            return res.status(200).json({
                success: true,
                data: updatedData
            });
        }

        // ==========================================
        // METHOD: DELETE (PURGE LOG RECORD)
        // ==========================================
        if (req.method === "DELETE") {
            const { id, uuid } = req.query;

            if (uuid) {
                const { error: bulkClearError } = await supabase
                    .from("history")
                    .delete()
                    .eq("uuid", uuid);

                if (bulkClearError) throw bulkClearError;

                return res.status(200).json({
                    success: true,
                    message: "All database ledger rows completely cleared for this profile node."
                });
            }

            if (!id) {
                return res.status(400).json({ success: false, error: "Missing required reference criteria parameters." });
            }

            const { error: deletionError } = await supabase
                .from("history")
                .delete()
                .eq("id", id);

            if (deletionError) throw deletionError;

            return res.status(200).json({
                success: true,
                message: "Database row completely purged out of records trace layout files."
            });
        }

        return res.status(405).json({ success: false, error: "HTTP Method context blocked." });

    } catch (err) {
        console.error("❌ Admin History Endpoint Error Exception Logs:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
}