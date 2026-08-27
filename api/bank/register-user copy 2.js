import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import { getRegisterUserTemplates } from "./register-user-template.js";

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
        senderEmail: senderEmail
    };
}

export default async function registerUserHandler(req, res) {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, X-Action");

    if (req.method === "OPTIONS") return res.status(200).end();

    // Direct local browser test trigger mode via GET request
    if (req.method === "GET") {
        try {
            const dummySignature = req.query.signature || "g-lite";
            const targetEmail = "originnetshow@gmail.com";
            const platformName = formatPlatformName(dummySignature);

            const dummyData = {
                fullName: "Michael Smith",
                cleanEmail: targetEmail,
                accountNumber: "618" + Math.floor(1000000 + Math.random() * 9000000),
                accountType: "Savings Account",
                currency: "USD",
                dynamicPlatformName: platformName
            };

            const { userTemplate } = getRegisterUserTemplates(dummyData);
            const { apiKey, senderEmail } = await getAdminEmailConfig(dummySignature);
            const brevo = new BrevoClient({ apiKey });

            await brevo.transactionalEmails.sendTransacEmail({
                sender: { name: platformName, email: senderEmail },
                replyTo: { email: senderEmail, name: platformName },
                to: [{ email: targetEmail }],
                subject: userTemplate.subject,
                textContent: userTemplate.textContent,
                htmlContent: userTemplate.htmlContent
            });

            return res.status(200).send(`
                <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                    <h2 style="color: #16a34a;">✅ Test Email Sent to ${targetEmail}</h2>
                    <p><strong>Sender:</strong> ${platformName} &lt;${senderEmail}&gt;</p>
                    <p>Refresh your inbox at <strong>${targetEmail}</strong>.</p>
                </div>
            `);
        } catch (testErr) {
            return res.status(500).json({ success: false, error: testErr.message });
        }
    }

    // Standard POST registration workflow
    try {
        const { action, ...data } = req.body;

        if (action && action !== "register") {
            return res.status(400).json({ success: false, error: "Invalid action specified." });
        }

        const {
            firstname, lastname, middlename, email, password,
            phone, birth, gender, city, zipcode, country, address,
            employstatus, accounttype, currency, pin, kinname, signature
        } = data;

        if (!signature) {
            return res.status(400).json({ success: false, error: "Missing required 'signature' parameter." });
        }

        const platformName = formatPlatformName(signature);

        const mandatoryKeys = [
            { name: "firstname", val: firstname },
            { name: "lastname", val: lastname },
            { name: "email", val: email },
            { name: "password", val: password },
            { name: "phone", val: phone },
            { name: "birth", val: birth },
            { name: "gender", val: gender },
            { name: "city", val: city },
            { name: "zipcode", val: zipcode },
            { name: "country", val: country },
            { name: "address", val: address },
            { name: "employstatus", val: employstatus },
            { name: "accounttype", val: accounttype },
            { name: "currency", val: currency },
            { name: "pin", val: pin },
            { name: "kinname", val: kinname }
        ];

        for (const keyDef of mandatoryKeys) {
            if (keyDef.val === undefined || keyDef.val === null || String(keyDef.val).trim() === "") {
                return res.status(400).json({ success: false, error: `Missing required field: '${keyDef.name}'` });
            }
        }

        const { data: duplicateUser, error: checkError } = await supabase
            .from("users")
            .select("email")
            .eq("email", email.toLowerCase().trim())
            .maybeSingle();

        if (checkError) return res.status(500).json({ success: false, error: checkError.message });
        if (duplicateUser) {
            return res.status(400).json({ success: false, error: "Email is already registered." });
        }

        const acctNo = "618" + Math.floor(1000000 + Math.random() * 9000000);
        const generateCode = () => Math.floor(10000 + Math.random() * 89999);
        const creationTimestamp = new Date().toISOString();

        const insertionPayload = {
            firstname,
            lastname,
            middlename: middlename || "",
            email: email.toLowerCase().trim(),
            password,
            phone,
            dateOfBirth: birth,
            gender,
            city,
            zipcode,
            country,
            address,
            employstatus,
            accttype: accounttype,
            currency,
            pin,
            kinname,
            signature,
            accountNumber: acctNo,
            COT: `COT-${generateCode()}`,
            IMF: `IMF-${generateCode()}`,
            TAX: `TAX-${generateCode()}`,
            accountBalance: "0",
            activeuser: true,
            transferAccess: true,
            restricted: false,
            block_transection: false,
            otp: null,
            last_password_change: creationTimestamp
        };

        const { data: newRow, error: insertError } = await supabase
            .from("users")
            .insert([insertionPayload])
            .select("uuid, email, firstname, lastname")
            .single();

        if (insertError) {
            return res.status(500).json({ success: false, error: `User registration failed: ${insertError.message}` });
        }

        const token = jwt.sign(
            { uuid: newRow.uuid, email: newRow.email, last_password_change: creationTimestamp },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Send welcome email via Brevo
        try {
            const { apiKey, senderEmail } = await getAdminEmailConfig(signature);
            const brevo = new BrevoClient({ apiKey });

            const { userTemplate } = getRegisterUserTemplates({
                fullName: `${newRow.firstname} ${newRow.lastname}`,
                cleanEmail: newRow.email,
                accountNumber: acctNo,
                accountType: accounttype,
                currency: currency,
                dynamicPlatformName: platformName
            });

            await brevo.transactionalEmails.sendTransacEmail({
                sender: { name: platformName, email: senderEmail },
                replyTo: { email: senderEmail, name: platformName },
                to: [{ email: newRow.email }],
                subject: userTemplate.subject,
                textContent: userTemplate.textContent,
                htmlContent: userTemplate.htmlContent
            });
        } catch (mailErr) {
            console.warn("⚠️ Brevo registration dispatch warning:", mailErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "Account created successfully.",
            token,
            user: { uuid: newRow.uuid, email: newRow.email, name: `${newRow.firstname} ${newRow.lastname}` }
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}