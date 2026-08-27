import { createClient } from "@supabase/supabase-js";
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

export default async function handler(req, res) {
    // Standard Global Administrative CORS Preflight Verification Headers
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    }

    // Allow all HTTP methods your handlers use
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    // Explicitly allow all your specific custom app headers
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, X-Action, X-Action-Phase, X-Transaction-Pin, X-User-UUID, X-Setting-Target, x-setting-target");

    // Keep your credentials authentication layer active
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle preflight options request immediately
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Route safety check
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method blocked." });
    }

    try {
        const { email, password, signature } = req.body;

        if (!email || !password || !signature) {
            return res.status(400).json({ success: false, error: "Missing required identification keys." });
        }

        // LOOKUP WITHIN THE CORRECT 'admin_2' CONTROL TABLE
        const { data: adminRecord, error: dbError } = await supabase
            .from("admin_2")
            .select("id, email, password, signature")
            .ilike("email", email.trim())
            .eq("signature", signature.trim())
            .maybeSingle();

        if (dbError) {
            throw new Error(`Database connection failed: ${dbError.message}`);
        }

        if (!adminRecord) {
            return res.status(401).json({
                success: false,
                error: `Administrative profile matching signature workspace environments is not registered.`
            });
        }

        // VERIFY CREDENTIALS ACCORDING TO SCHEMA
        if (adminRecord.password !== password) {
            return res.status(401).json({ success: false, error: "Invalid cleartext access phrase signature sequence." });
        }

        if (adminRecord.signature !== signature) {
            return res.status(403).json({ success: false, error: "Console signature mismatch context tracking error." });
        }

        // ENCODE DATA FOR SUBSEQUENT DIRECTORY CALLS
        const sessionPayload = {
            adminId: adminRecord.id,
            email: adminRecord.email,
            signature: adminRecord.signature,
            role: "console-admin"
        };

        const token = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: "24h" });

        return res.status(200).json({
            success: true,
            message: "Administrative console access verified completely.",
            token: token
        });

    } catch (faultException) {
        console.error("❌ Auth Handshake Exception Node:", faultException.message);
        return res.status(500).json({ success: false, error: faultException.message });
    }
}