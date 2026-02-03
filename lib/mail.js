import brevo from '@getbrevo/brevo';
import dotenv from "dotenv";

dotenv.config();

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

export const sendVerificationEmail = async (email, otp) => {
    try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();

        sendSmtpEmail.subject = "Verify your email - BigChat";
        sendSmtpEmail.htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to BigChat</h1>
          </div>
          <div style="padding: 40px 20px; text-align: center; background-color: #ffffff;">
            <h2 style="color: #111827; margin-top: 0;">Verify Your Email Address</h2>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
              Thank you for signing up! Please use the verification code below to complete your registration.
            </p>
            <div style="background-color: #f3f4f6; padding: 15px 25px; border-radius: 8px; display: inline-block; margin-bottom: 30px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              This code will expire in 10 minutes. If you didn't create an account with Chatty, you can safely ignore this email.
            </p>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Chatty App. All rights reserved.
            </p>
          </div>
        </div>
      `;
        sendSmtpEmail.sender = { name: "BigChat", email: "jophin735@gmail.com" };
        sendSmtpEmail.to = [{ email: email }];

        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Email sent:", result.body.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};
