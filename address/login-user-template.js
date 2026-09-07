export function getLoginUserAdminTemplate({ user, dynamicPlatformName }) {
    const loginTime = new Date().toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "medium"
    });

    const userName = user.full_name || user.username || "User";
    const userIdentifier = user.email || user.username || "N/A";

    const textContent = `Hello Administrator,\n\nA member signed into ${dynamicPlatformName}.\n\nAccount: ${userName} (${userIdentifier})\nTime: ${loginTime}\n\nThis is an automated operational notice.`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${dynamicPlatformName} Activity Notice</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
    <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">${dynamicPlatformName} Member Sign-In Notice</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #475569;">
            A user has logged into their ${dynamicPlatformName} account.
        </p>
        
        <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Name:</strong> ${user.full_name || "N/A"}</p>
            <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Username:</strong> ${user.username || "N/A"}</p>
            <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 0; font-size: 13px;"><strong>Timestamp:</strong> ${loginTime}</p>
        </div>

        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            Automated system event notification.
        </p>
    </div>
</body>
</html>`;

    return { textContent, htmlContent };
}