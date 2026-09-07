export function getRegisterUserTemplates({
    fullName = "Account Holder",
    cleanEmail = "",
    accountNumber = "",
    accountType = "Standard Account",
    currency = "USD",
    dynamicPlatformName = "Platform"
} = {}) {
    const userSubject = `Your ${dynamicPlatformName} account reference: ${accountNumber}`;

    const userTextContent = `Hello ${fullName},

Your account with ${dynamicPlatformName} is active.

Account Details:
- Name: ${fullName}
- Account Number: ${accountNumber}
- Type: ${accountType}
- Currency: ${currency}

If you have questions regarding this setup, please contact customer support.

Regards,
${dynamicPlatformName} Customer Support`;

    const userHtmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${dynamicPlatformName} Account</title>
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #222222; background-color: #ffffff; margin: 0; padding: 20px;">
    <div style="max-width: 560px; margin: 0 auto; border: 1px solid #dddddd; padding: 25px; border-radius: 4px;">
        <h2 style="font-size: 18px; color: #111111; margin-top: 0;">Welcome to ${dynamicPlatformName}</h2>
        <p>Hello ${fullName},</p>
        <p>Your online account registration has been processed successfully.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #555555;">Account Name:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; text-align: right;">${fullName}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #555555;">Account Number:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; text-align: right;">${accountNumber}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #555555;">Account Type:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; text-align: right;">${accountType}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #555555;">Currency:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; text-align: right;">${currency}</td>
            </tr>
        </table>

        <p>You may now sign in to your profile to manage your account details securely.</p>
        
        <p style="margin-top: 30px; font-size: 12px; color: #777777; border-top: 1px solid #eeeeee; padding-top: 15px;">
            This email was sent to ${cleanEmail} regarding your recent registration with ${dynamicPlatformName}.
        </p>
    </div>
</body>
</html>`;

    return {
        userTemplate: {
            subject: userSubject,
            textContent: userTextContent,
            htmlContent: userHtmlContent
        }
    };
}