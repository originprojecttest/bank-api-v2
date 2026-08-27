import { createClient } from "@supabase/supabase-js";
import { BrevoClient } from "@getbrevo/brevo";
import jwt from "jsonwebtoken";
import ws from "ws";
import { generateDebitAlertTemplate, generateCreditAlertTemplate } from "./local-template.js";

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
      return res.status(401).json({ success: false, error: "Session expired or invalid token." });
    }

    const { data: senderData, error: senderError } = await supabase
      .from("users")
      .select("*")
      .eq("uuid", decodedToken.uuid)
      .maybeSingle();

    if (senderError || !senderData) {
      return res.status(444).json({ success: false, error: "Sender profile node terminated." });
    }

    if (senderData.block_transection === true || senderData.block_transection === "true") {
      return res.status(403).json({
        success: false,
        error: "can't make any transfer at the moment please contact or chat customer-care server"
      });
    }

    const actionPhase = req.headers['x-action-phase'];

    if (actionPhase === 'lock-account') {
      const { error: lockExecutionError } = await supabase
        .from("users")
        .update({ block_transection: true })
        .eq("id", senderData.id);

      if (lockExecutionError) {
        return res.status(500).json({ success: false, error: "Failed to update profile lock boundaries." });
      }
      return res.status(200).json({ success: true, message: "Security threshold triggered. Account restricted." });
    }

    const { recipientAccountNumber, transactionAmount, paymentMemo } = req.body;
    const parsedAmount = parseFloat(transactionAmount);

    if (!recipientAccountNumber || !transactionAmount || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid operational parameter dimensions." });
    }

    if (senderData.accountNumber === recipientAccountNumber) {
      return res.status(400).json({ success: false, error: "Can't send money to your own account" });
    }

    const { data: recipientData, error: recipientError } = await supabase
      .from("users")
      .select("*")
      .eq("accountNumber", recipientAccountNumber)
      .eq("signature", senderData.signature)
      .maybeSingle();

    if (recipientError || !recipientData) {
      return res.status(404).json({ success: false, error: "Invalid recipient account mapping parameters." });
    }

    if (senderData.currency !== recipientData.currency) {
      return res.status(400).json({ success: false, error: "Can't send money to account with a different currency. Use International Transfer" });
    }

    const currentSenderBalance = parseFloat(senderData.accountBalance || "0");
    if (currentSenderBalance < parsedAmount) {
      return res.status(400).json({ success: false, error: "Liquidity clearance exception: Insufficient balance." });
    }

    const buildFormattedName = (userRow) => {
      const first = userRow.firstname || "";
      const middle = userRow.middlename || "";
      const last = userRow.lastname || "";
      return [first, middle, last].filter(nameSegment => nameSegment.trim() !== "").join(" ");
    };

    const senderFullName = buildFormattedName(senderData);
    const recipientFullName = buildFormattedName(recipientData);

    if (actionPhase === 'validate') {
      return res.status(200).json({
        success: true,
        phase: "validated",
        recipientName: recipientFullName
      });
    }

    const clientSecuredPin = req.headers['x-transaction-pin'];
    if (!clientSecuredPin || clientSecuredPin !== senderData.pin) {
      return res.status(401).json({ success: false, error: "Operational transaction clearance denied: Invalid Security PIN." });
    }

    const rawNewSenderBal = (currentSenderBalance - parsedAmount).toString();
    const rawNewRecipientBal = (parseFloat(recipientData.accountBalance || "0") + parsedAmount).toString();

    const { error: deductErr } = await supabase
      .from("users")
      .update({ accountBalance: rawNewSenderBal })
      .eq("id", senderData.id);

    if (deductErr) throw new Error("Sender asset balance reduction exception.");

    const { error: creditErr } = await supabase
      .from("users")
      .update({ accountBalance: rawNewRecipientBal })
      .eq("id", recipientData.id);

    if (creditErr) {
      await supabase.from("users").update({ accountBalance: currentSenderBalance.toString() }).eq("id", senderData.id);
      throw new Error("Recipient asset clearance allocation error.");
    }

    const currentTimestampString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    await supabase.from("history").insert([
      {
        amount: `-${parsedAmount}`,
        date: currentTimestampString,
        description: paymentMemo || "Intra-Bank Local Debit Distribution",
        transactionType: "Debit",
        uuid: senderData.uuid,
        name: recipientFullName,
        signature: senderData.signature
      },
      {
        amount: `+${parsedAmount}`,
        date: currentTimestampString,
        description: paymentMemo || "Intra-Bank Local Credit Synchronization",
        transactionType: "Credit",
        uuid: recipientData.uuid,
        name: senderFullName,
        signature: recipientData.signature
      }
    ]);

    // Brevo Transactional Email Notification Pipeline
    try {
      const { apiKey, senderEmail } = await getAdminEmailConfig(senderData.signature);
      const brevo = new BrevoClient({ apiKey });
      const platformName = formatPlatformName(senderData.signature);

      // Sender gets Debit template (International style); Receiver gets Credit template
      await Promise.all([
        brevo.transactionalEmails.sendTransacEmail({
          sender: { name: platformName, email: senderEmail },
          to: [{ email: senderData.email.trim() }],
          subject: `${platformName} New Transaction`,
          htmlContent: generateDebitAlertTemplate(
            platformName,
            senderData,
            recipientFullName,
            rawNewSenderBal,
            parsedAmount
          )
        }),
        brevo.transactionalEmails.sendTransacEmail({
          sender: { name: platformName, email: senderEmail },
          to: [{ email: recipientData.email.trim() }],
          subject: `New message notification - ${recipientData.signature}`,
          htmlContent: generateCreditAlertTemplate(
            platformName,
            recipientData,
            senderFullName,
            rawNewRecipientBal,
            parsedAmount,
            paymentMemo,
            currentTimestampString
          )
        })
      ]);

      console.log("📨 Transactional emails sent via Brevo to both sender and receiver.");

    } catch (brevoPipeError) {
      console.warn("⚠️ Ledger entry committed but Brevo notification engine caught an anomaly:", brevoPipeError.message);
    }

    return res.status(200).json({ success: true, message: "Ledger clearance transaction executed successfully." });

  } catch (globalExecutionError) {
    console.error("❌ Local clearing execution node exception error:", globalExecutionError);
    return res.status(500).json({ success: false, error: globalExecutionError.message });
  }
}