import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

export interface SmtpConfig {
  backend: string;
  host: string;
  port: number;
  useTls: boolean;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  defaultFrom: string;
  agentFrom: string;
}

// Default fallback SMTP configuration:
export const HARDCODED_SMTP_CONFIG: SmtpConfig = {
  backend: "django.core.mail.backends.smtp.EmailBackend",
  host: "smtp.gmail.com",
  port: 587,
  useTls: true,
  secure: false, // port 587 uses STARTTLS
  auth: {
    user: "codershub99@gmail.com",
    pass: "udheclwwyswgyixg",
  },
  defaultFrom: "codershub99@gmail.com",
  agentFrom: "codershub99@gmail.com",
};

export function getActiveSmtpConfig(): SmtpConfig {
  const hostUser = (process.env.EMAIL_HOST_USER || HARDCODED_SMTP_CONFIG.auth.user).trim();
  // Strip any internal spaces Google app passwords commonly display (e.g. 'ufpp qlla mawt wrcq' -> 'ufppqllamawtwrcq')
  const rawPass = process.env.EMAIL_HOST_PASSWORD || HARDCODED_SMTP_CONFIG.auth.pass;
  const hostPass = rawPass.trim().replace(/\s+/g, "");
  const host = (process.env.EMAIL_HOST || HARDCODED_SMTP_CONFIG.host).trim();
  const port = parseInt(process.env.EMAIL_PORT || String(HARDCODED_SMTP_CONFIG.port), 10);
  const from = (process.env.DEFAULT_FROM_EMAIL || hostUser).trim();

  return {
    backend: process.env.EMAIL_BACKEND || HARDCODED_SMTP_CONFIG.backend,
    host,
    port,
    useTls: true,
    secure: port === 465,
    auth: {
      user: hostUser,
      pass: hostPass,
    },
    defaultFrom: from,
    agentFrom: (process.env.AGENT_FROM_EMAIL || from).trim(),
  };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private createTransporter(): Transporter {
    const config = getActiveSmtpConfig();
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string;
  }): Promise<boolean> {
    const config = getActiveSmtpConfig();
    const transporter = this.createTransporter();

    try {
      const from = options.from || config.defaultFrom;
      const info = await transporter.sendMail({
        from: `"Coders Hub" <${from}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(`Email sent successfully to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${options.to}: ${errorMsg}`);

      if (errorMsg.includes("BadCredentials") || errorMsg.includes("535")) {
        this.logger.warn(`
================================================================================
⚠️ [MailService] Gmail SMTP Authentication Failed (535 BadCredentials)
Target Account: ${config.auth.user}
Reason: Google rejected the username or app password.

How to fix:
1. Ensure 2-Step Verification is active on: ${config.auth.user}
2. Open: https://myaccount.google.com/apppasswords
3. Generate a new 16-character App Password (e.g. named "CodersHub Backend").
4. Update EMAIL_HOST_PASSWORD in backend/.env (or environment variables).
================================================================================
        `);
      }
      return false;
    }
  }

  async sendPasswordResetOtp(to: string, otp: string): Promise<boolean> {
    // Print clear visual banner so developers/testers can always see the code in terminal
    this.logger.log(`
================================================================================
🔑 [MailService] PASSWORD RESET OTP CODE FOR: ${to}
👉 VERIFICATION CODE: ${otp}  (Valid for 15 minutes)
================================================================================
    `);

    const subject = `Your Coders Hub Password Reset Code: ${otp}`;
    const text = `Hello,\n\nYou requested to reset your password for your Coders Hub account.\n\nYour 6-digit OTP verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020308; color: #ffffff; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #140d2d; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 32px; box-shadow: 0 12px 35px rgba(0,0,0,0.4);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 8px 0; font-weight: 700;">Reset Your Password</h1>
            <p style="color: rgba(255, 255, 255, 0.6); font-size: 13px; margin: 0;">Use the verification code below to reset your password on Coders Hub.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background: #09061a; border: 1px solid rgba(0, 239, 145, 0.4); border-radius: 10px; padding: 16px 36px;">
              <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #00ef91;">${otp}</span>
            </div>
          </div>

          <p style="color: rgba(255, 255, 255, 0.7); font-size: 13px; line-height: 1.6; text-align: center; margin-bottom: 24px;">
            This OTP code is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
          </p>

          <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 24px 0;" />

          <p style="color: rgba(255, 255, 255, 0.35); font-size: 11px; text-align: center; margin: 0;">
            &copy; 2026 Coders Hub Inc. All rights reserved.
          </p>
        </div>
      </div>
    `;

    return this.sendMail({
      to,
      subject,
      text,
      html,
    });
  }
}
