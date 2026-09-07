// Debit Template (uses the international email layout)
export const generateDebitAlertTemplate = (
    platformName,
    user,
    counterpartDisplayFullName,
    postBal,
    parsedAmount
) => {
    const currency = user.currency || "$";
    const firstName = user.firstname || "Customer";
    const formattedAmount = parsedAmount.toFixed(2);
    const formattedBalance = parseFloat(postBal).toFixed(2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${platformName} Transaction Notification</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:Arial, sans-serif; color:#333333;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f5f7; padding:20px 0;">
        <tbody>
            <tr>
                <td align="center">
                    <table role="presentation" width="500" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:24px; text-align:left;">
                        <tbody>
                            <tr>
                                <td>
                                    <h2 style="margin:0 0 16px 0; font-size:20px; color:#1a202c;">${platformName} Transaction Alert</h2>
                                    <p style="margin:0 0 12px 0; font-size:15px; color:#4a5568;">Hello ${firstName},</p>
                                    <p style="margin:0 0 16px 0; font-size:14px; color:#4a5568; line-height:1.5;">An outgoing transaction has been processed on your account:</p>
                                    
                                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color:#f7fafc; border:1px solid #edf2f7; border-radius:4px; margin-bottom:16px;">
                                        <tbody>
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
                                        </tbody>
                                    </table>

                                    <p style="margin:0; font-size:12px; color:#a0aec0; line-height:1.4;">
                                        If you did not authorize this activity, please contact support immediately.
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>
</html>`;
};

// Credit Template (Original systemic desk notification that lands in inbox)
export const generateCreditAlertTemplate = (
    platformName,
    user,
    counterpartDisplayFullName,
    postBal,
    parsedAmount,
    paymentMemo,
    currentTimestampString
) => {
    const currency = user.currency || "$";
    const formattedAmount = parsedAmount.toFixed(2);
    const formattedBalance = parseFloat(postBal).toFixed(2);

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <style type="text/css">
        body { width: 100% !important; margin: 0; padding: 0; font-family: Arial, sans-serif; color: #333333; background-color: #ffffff; }
        p { margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #333333; }
    </style>
</head>
<body style="margin: 0; padding: 30px 20px; background-color: #ffffff;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; text-align: left;">
        <tr>
            <td style="padding: 0 0 20px 0; border-bottom: 1px solid #e2e8f0; font-size: 16px; font-weight: bold; color: #111111;">
                ${platformName} System Desk Communication
            </td>
        </tr>
        <tr>
            <td style="padding: 24px 0 16px 0;">
                <p>Hello ${user.firstname || "User"},</p>
                <p>This statement confirms that a balance modification event has occurred and successfully processed for your ledger account profile:</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 10px 0 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 12px 16px; background-color: #f8fafc; border-left: 3px solid #0ea365; font-size: 14px; line-height: 22px; color: #475569;">
                            Operation Context: Account Balance Allocation Update<br />
                            Value Processed: ${currency}${formattedAmount}<br />
                            Associated Profile Link: ${counterpartDisplayFullName}<br />
                            Reference Tracking Memo: ${paymentMemo || 'System Internal Ledger Event'}<br />
                            Updated Balance Status: ${currency}${formattedBalance}<br />
                            Execution Processing Timestamp: ${currentTimestampString}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding: 16px 0 30px 0; border-bottom: 1px solid #e2e8f0;">
                <p>To view full parameters, verify processing chains, or track transaction timelines, please log directly into your system workspace profile.</p>
                <p style="margin: 0;">Thank you,<br />Operational Support Infrastructure Desk</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 0 0 0; font-size: 11px; line-height: 16px; color: #999999;">
                This is an automated operational notification thread. Responses sent directly to this systemic verification entry are unmonitored.
            </td>
        </tr>
    </table>
</body>
</html>`;
};