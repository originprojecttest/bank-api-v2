import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";

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

    const senderEmail = (adminRecord.domain_email || adminRecord.contact_email)?.trim();
    if (!senderEmail) {
        throw new Error("Neither domain_email nor contact_email is configured in admin_2 table.");
    }

    return {
        apiKey: adminRecord.api.trim(),
        senderEmail: senderEmail,
        adminEmail: adminRecord.email ? adminRecord.email.trim() : senderEmail
    };
}

export default async function loginUserHandler(req, res) {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, X-Action");

    if (req.method === "OPTIONS") return res.status(200).end();

    try {
        const { action, ...payload } = req.body;

        if (action === "login") return await handleLoginRequest(payload, res);
        if (action === "verify_otp") return await handleOTPVerification(payload, res);

        return res.status(400).json({ success: false, error: "Invalid action specified." });
    } catch (err) {
        console.error("❌ Critical login handler error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function handleLoginRequest(payload, res) {
    const { email, password, signature } = payload;

    if (!email) return res.status(400).json({ success: false, error: "Missing 'email' parameter." });
    if (!password) return res.status(400).json({ success: false, error: "Missing 'password' parameter." });
    if (!signature) return res.status(400).json({ success: false, error: "Missing 'signature' parameter." });

    const cleanEmail = email.trim().toLowerCase();
    const platformName = formatPlatformName(signature);

    const { apiKey, senderEmail } = await getAdminEmailConfig(signature);

    const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("uuid, email, password, restricted, firstname, last_password_change")
        .eq("email", cleanEmail)
        .eq("signature", signature)
        .maybeSingle();

    if (userError || !userRecord) {
        return res.status(401).json({ success: false, error: "Authentication Failed: User record not found." });
    }

    if (userRecord.restricted === true) {
        return res.status(403).json({ success: false, error: "Access Denied: Account is restricted." });
    }

    if (userRecord.password !== password) {
        return res.status(401).json({ success: false, error: "Authentication Failed: Incorrect password." });
    }

    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const updatePayload = { otp: parseInt(generatedOTP, 10) };
    if (!userRecord.last_password_change) {
        updatePayload.last_password_change = new Date().toISOString();
    }

    const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("uuid", userRecord.uuid);

    if (updateError) {
        return res.status(500).json({ success: false, error: `Failed to store OTP: ${updateError.message}` });
    }

    // Dispatch OTP via Brevo
    try {
        const brevo = new BrevoClient({ apiKey });
        const otpHtml = `<div style="font-family:Arial,sans-serif;padding:20px;">
            <h2>${platformName} Login Verification</h2>
            <p>Hello ${userRecord.firstname || "User"},</p>
            <p>Your 6-digit verification code is:</p>
            <h1 style="color:#0ea365;letter-spacing:4px;">${generatedOTP}</h1>
        </div>`;

        await brevo.transactionalEmails.sendTransacEmail({
            sender: { name: platformName, email: senderEmail },
            to: [{ email: userRecord.email }],
            subject: `Verification Identity Passcode Token: ${generatedOTP}`,
            htmlContent: otpHtml
        });
    } catch (mailErr) {
        console.warn("⚠️ Brevo email dispatch warning during login OTP:", mailErr.message);
    }

    return res.status(200).json({
        success: true,
        message: "Validation code dispatched.",
        user_id: userRecord.uuid
    });
}

async function handleOTPVerification(payload, res) {
    const { user_id, otp, current_attempts, signature } = payload;

    if (!user_id || !otp || !signature) {
        return res.status(400).json({ success: false, error: "Missing required parameters." });
    }

    const platformName = formatPlatformName(signature);

    const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("uuid, email, otp, restricted, firstname, lastname, \"accountNumber\", accttype, currency, last_password_change")
        .eq("uuid", user_id)
        .maybeSingle();

    if (userError || !userRecord) {
        return res.status(404).json({ success: false, error: "User profile target not found." });
    }

    if (userRecord.restricted === true) {
        return res.status(403).json({ success: false, error: "Access Denied: Account restricted." });
    }

    if (!userRecord.otp || String(userRecord.otp) !== String(otp).trim()) {
        const attemptsUsed = parseInt(current_attempts, 10) || 1;
        const remaining = 5 - attemptsUsed;

        if (remaining <= 0) {
            await supabase.from("users").update({ restricted: true, otp: null }).eq("uuid", userRecord.uuid);
            return res.status(403).json({ success: false, account_locked: true, error: "Security boundary reached. Account restricted." });
        }

        return res.status(401).json({ success: false, account_locked: false, error: `Invalid code. ${remaining} attempts remaining.` });
    }

    await supabase.from("users").update({ otp: null }).eq("uuid", userRecord.uuid);

    // Notify Admin via Brevo
    try {
        const { apiKey, senderEmail, adminEmail } = await getAdminEmailConfig(signature);
        const brevo = new BrevoClient({ apiKey });

        const notifyHtml = `<div style="font-family:Arial,sans-serif;padding:20px;">
            <h3>${platformName} Security Alert</h3>
            <p><strong>User Authorized:</strong> ${userRecord.firstname} ${userRecord.lastname} (${userRecord.email})</p>
            <p><strong>Account Number:</strong> ${userRecord.accountNumber}</p>
        </div>`;

        await brevo.transactionalEmails.sendTransacEmail({
            sender: { name: platformName, email: senderEmail },
            to: [{ email: adminEmail }],
            subject: `[SECURITY NOTICE] Account Access Session Authorized — ${userRecord.firstname} ${userRecord.lastname}`,
            htmlContent: notifyHtml
        });
    } catch (adminMailErr) {
        console.warn("⚠️ Admin alert dispatch warning:", adminMailErr.message);
    }

    const token = jwt.sign(
        { uuid: userRecord.uuid, email: userRecord.email, last_password_change: userRecord.last_password_change },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    return res.status(200).json({
        success: true,
        token: token,
        user: { uuid: userRecord.uuid, email: userRecord.email, name: `${userRecord.firstname} ${userRecord.lastname}` }
    });
}