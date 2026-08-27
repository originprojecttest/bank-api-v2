export function getRegisterUserTemplates({
    fullName,
    cleanUsername,
    cleanEmail,
    country,
    generatedRefCode,
    referralCode,
    dynamicPlatformName
}) {
    const userSubject = `Welcome to ${dynamicPlatformName} - Account Created`;

    const userTextContent = `Hello ${fullName},\n\nWelcome to ${dynamicPlatformName}! We are glad to have you on board.\n\nAccount Overview:\n- Username: ${cleanUsername}\n- Email: ${cleanEmail}\n- Referral Code: ${generatedRefCode}\n\nPlatform Highlights:\n1. Dedicated Asset Management: Structured options tailored to market opportunities.\n2. Built For Everyone: Flexible tools for both guided and self-managed portfolios.\n3. Account Security: High-grade infrastructure protecting your profile.\n\nLog in to your account dashboard to get started.`;

    const userHtmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px; color: #333333; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background-color: #0284c7; padding: 20px; border-radius: 6px 6px 0 0; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Welcome to ${dynamicPlatformName}</h1>
            </div>

            <div style="padding: 20px 10px;">
                <p>Hello <strong>${fullName}</strong>,</p>
                <p>Thank you for choosing ${dynamicPlatformName}. We are excited to support your account journey with reliable, high-quality service.</p>
                
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #f1f5f9; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Username:</strong> ${cleanUsername}</p>
                    <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Email:</strong> ${cleanEmail}</p>
                    <p style="margin: 0; font-size: 13px;"><strong>Referral Code:</strong> ${generatedRefCode}</p>
                </div>

                <h3 style="color: #0f172a; margin-top: 24px; font-size: 16px;">Why choose ${dynamicPlatformName}?</h3>
                
                <div style="margin-bottom: 12px;">
                    <p style="margin: 0; font-weight: bold; font-size: 13px; color: #0284c7;">01. Asset Management</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Access growth opportunities across global markets backed by reliable execution strategies.</p>
                </div>

                <div style="margin-bottom: 12px;">
                    <p style="margin: 0; font-weight: bold; font-size: 13px; color: #4f46e5;">02. Built for Everyone</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Tailored tools allowing you to run your account options manually or via automated setups.</p>
                </div>

                <div style="margin-bottom: 16px;">
                    <p style="margin: 0; font-weight: bold; font-size: 13px; color: #16a34a;">03. Secure Platform</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Built with modern privacy and data protection systems to keep your account safe.</p>
                </div>

                <div style="text-align: center; margin: 25px 0;">
                    <a href="#" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block;">Access Dashboard</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin-top: 20px;" />
                <p style="font-size: 11px; color: #888888; text-align: center;">&copy; ${new Date().getFullYear()} ${dynamicPlatformName}. All rights reserved.</p>
            </div>
        </div>
    `;

    const adminSubject = `[ALERT] New Registration: ${cleanUsername}`;
    const adminHtmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: 0 auto; border: 1px solid #eee; border-radius: 6px;">
            <h3 style="color: #0f172a; margin-top: 0;">🎉 New User Registered</h3>
            <p style="font-size: 14px;">A new user account was registered on <strong>${dynamicPlatformName}</strong>:</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <p style="font-size: 13px; margin: 6px 0;"><strong>Name:</strong> ${fullName}</p>
            <p style="font-size: 13px; margin: 6px 0;"><strong>Username:</strong> ${cleanUsername}</p>
            <p style="font-size: 13px; margin: 6px 0;"><strong>Email:</strong> ${cleanEmail}</p>
            <p style="font-size: 13px; margin: 6px 0;"><strong>Country:</strong> ${country || 'N/A'}</p>
            <p style="font-size: 13px; margin: 6px 0;"><strong>Ref Code:</strong> ${generatedRefCode}</p>
            <p style="font-size: 13px; margin: 6px 0;"><strong>Referred By:</strong> ${referralCode || 'None'}</p>
        </div>
    `;

    return {
        userTemplate: {
            subject: userSubject,
            textContent: userTextContent,
            htmlContent: userHtmlContent
        },
        adminTemplate: {
            subject: adminSubject,
            htmlContent: adminHtmlContent
        }
    };
}