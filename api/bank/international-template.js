export const generateInternationalAlertTemplate = (
    platformName,
    user,
    counterpartDisplayFullName,
    postBal,
    parsedAmount,
    paymentMemo,
    currentTimestampString
) => {
    const currency = user.currency || "$";
    const firstName = user.firstname || "Customer";
    const formattedAmount = parsedAmount.toFixed(2);
    const formattedBalance = parseFloat(postBal).toFixed(2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${platformName} Transaction Notification</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:Arial, sans-serif; color:#333333;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f5f7; padding:20px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="500" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:24px; text-align:left;">
                    <tr>
                        <td>
                            <h2 style="margin:0 0 16px 0; font-size:20px; color:#1a202c;">${platformName} Transaction Alert</h2>
                            <p style="margin:0 0 12px 0; font-size:15px; color:#4a5568;">Hello ${firstName},</p>
                            <p style="margin:0 0 16px 0; font-size:14px; color:#4a5568; line-height:1.5;">An outgoing transaction has been processed on your account:</p>
                            
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color:#f7fafc; border:1px solid #edf2f7; border-radius:4px; margin-bottom:16px;">
                                <tr>
                                    <td style="font-size:14px; color:#718096; width:40%;">Amount:</td>
                                    <td style="font-size:14px; font-weight:bold; color:#e53e3e; text-align:right;">${currency}${formattedAmount}</td>
                                </tr>
                                <tr>
                                    <td style="font-size:14px; color:#718096;">Recipient:</td>
                                    <td style="font-size:14px; font-weight:bold; color:#2d3748; text-align:right;">${counterpartDisplayFullName}</td>
                                </tr>
                                <tr>
                                    <td style="font-size:14px; color:#718096;">New Balance:</td>
                                    <td style="font-size:14px; font-weight:bold; color:#2b6cb0; text-align:right;">${currency}${formattedBalance}</td>
                                </tr>
                            </table>

                            <p style="margin:0; font-size:12px; color:#a0aec0; line-height:1.4;">
                                If you did not authorize this activity, please contact support immediately.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};