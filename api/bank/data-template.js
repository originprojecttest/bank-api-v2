export function getAccountDeactivatedTemplate({ userRecord, dynamicPlatformName }) {
    const firstName = userRecord.firstname || "";
    const lastName = userRecord.lastname || "";
    const fullName = [firstName, lastName].filter(s => s.trim() !== "").join(" ") || "Valued Customer";
    const accountNumber = userRecord.accountNumber || "N/A";

    const subject = `[SECURITY NOTICE] Account Access Suspended - ${dynamicPlatformName}`;

    const textContent = `Hello ${fullName},\n\nWe are writing to inform you that your ${dynamicPlatformName} account entry has been administratively suspended or deactivated.\n\nAccount Holder: ${fullName}\nAccount Number: ${accountNumber}\nStatus: Deactivated / Restricted\n\nYour active session tokens have been invalidated. If you believe this is an error, please contact support.`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Status Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #334155;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #dc2626; padding: 20px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.3px;">Security Notice: Access Suspended</h2>
        </div>
        <div style="padding: 28px; line-height: 1.6;">
            <p style="font-size: 15px; margin-top: 0;">Hello <strong>${fullName}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">We are writing to officially inform you that your <strong>${dynamicPlatformName}</strong> account has been administratively locked or deactivated.</p>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">Impacted Workspace Details:</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                        <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 40%;">Account Holder:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${fullName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Account Number:</td>
                        <td style="padding: 4px 0; color: #0f172a; font-family: monospace;">${accountNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Status Profile:</td>
                        <td style="padding: 4px 0; color: #dc2626; font-weight: 700;">Deactivated / Restricted</td>
                    </tr>
                </table>
            </div>
            
            <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">As a result of this action, all active authentication session cycles have been fully invalidated.</p>
        </div>
        <div style="padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            This is an automated operational notice from ${dynamicPlatformName}.
        </div>
    </div>
</body>
</html>`;

    return { subject, textContent, htmlContent };
}