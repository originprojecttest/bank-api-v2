import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import multer from "multer";
import { generateCustomerCareTemplate } from "./mail-template.js";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws }
});

// Configure multer to handle file upload in memory buffer
const upload = multer({ storage: multer.memoryStorage() });

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
        throw new Error("No domain_email, contact_email, or email configured in admin_2 record.");
    }

    // Prioritize contact_email, then general email, then senderEmail fallback for replies
    const contactEmail = (adminRecord.contact_email || adminRecord.email || senderEmail).trim();

    return {
        apiKey: adminRecord.api.trim(),
        senderEmail: senderEmail,
        contactEmail: contactEmail
    };
}

// Export a wrapper that applies multer middleware before running the handler logic
export default async function customerCareMailHandler(req, res) {
    upload.single("adminImage")(req, res, async (multerErr) => {
        if (multerErr) {
            return res.status(400).json({ success: false, error: "File upload error: " + multerErr.message });
        }

        const requestOrigin = req.headers.origin;
        if (requestOrigin) res.setHeader("Access-Control-Allow-Origin", requestOrigin);
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-setting-target");
        res.setHeader("Access-Control-Allow-Credentials", "true");

        if (req.method === "OPTIONS") return res.status(200).end();

        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ success: false, error: "Unauthorized access token." });
            }

            const token = authHeader.split(" ")[1];
            const decodedToken = jwt.verify(token, JWT_SECRET);

            const userId = req.params.id || req.query.id || req.body.id;
            const { recipientEmail, recipientName, supportMessage, subject } = req.body;
            const uploadedFile = req.file; // File object captured via multer

            const signature = decodedToken.signature || req.headers["x-setting-target"] || "g-lite";

            // 1. Fetch user from DB (`users` table)
            const { data: userRecord, error: dbError } = await supabase
                .from("users")
                .select("*")
                .eq("id", userId)
                .single();

            if (dbError || !userRecord) {
                throw new Error(dbError ? dbError.message : "User record not found.");
            }

            // 2. Fetch Admin Brevo Settings from `admin_2`
            const { apiKey, senderEmail, contactEmail } = await getAdminEmailConfig(signature);

            const platformName = formatPlatformName(signature);
            const accountNumber = userRecord.accountNumber || "N/A";
            const supportRef = `BNK-${accountNumber}-${Math.floor(100000 + Math.random() * 900000)}`;

            // 3. Generate HTML Template (Pass empty image since it's now an email attachment)
            const cleanedUserRecord = {
                ...userRecord,
                image: null
            };

            const htmlTemplate = generateCustomerCareTemplate(cleanedUserRecord, {
                recipientEmail,
                recipientName,
                supportMessage,
                supportRef,
                platformName
            });

            const emailSubject = subject || `[Ref: ${supportRef}] Support Update regarding Account #${accountNumber}`;
            const messageHeaderId = `<${supportRef}@banking-support.com>`;

            // 4. Build Brevo Payload with Reply-To and Attachments if available
            const emailPayload = {
                sender: { name: platformName, email: senderEmail },
                to: [{ email: recipientEmail.trim(), name: recipientName || `${userRecord.firstname || ""} ${userRecord.lastname || ""}`.trim() || "Valued Customer" }],
                replyTo: { email: contactEmail, name: `${platformName} Support` },
                subject: emailSubject,
                htmlContent: htmlTemplate,
                headers: {
                    "In-Reply-To": messageHeaderId,
                    "References": messageHeaderId,
                    "X-Support-Ref": supportRef
                }
            };

            if (uploadedFile) {
                emailPayload.attachment = [{
                    content: uploadedFile.buffer.toString("base64"),
                    name: uploadedFile.originalname || "attachment.png"
                }];
            }

            // 5. Send Email via Brevo
            const brevo = new BrevoClient({ apiKey });
            await brevo.transactionalEmails.sendTransacEmail(emailPayload);

            return res.status(200).json({
                success: true,
                support_ref: supportRef,
                message: "Support message sent successfully with attachment."
            });

        } catch (error) {
            console.error("❌ Support Mail Dispatch Error:", error.message);
            return res.status(500).json({
                success: false,
                error: error.message || "Failed to process and send support email."
            });
        }
    });
}