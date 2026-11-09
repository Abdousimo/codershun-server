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
    attachments?: Array<{
      filename: string;
      content?: any;
      path?: string;
      contentType?: string;
    }>;
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
        attachments: options.attachments,
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

  async sendInvoiceEmail(options: {
    to: string;
    invoiceNumber: string;
    companyName: string;
    currency: string;
    total: string;
    balanceDue: string;
    dueDate?: string | null;
    issueDate?: string | null;
    legalEntityName: string;
    bankDetails?: {
      bankName?: string | null;
      iban?: string | null;
      swiftBic?: string | null;
    };
    lines?: Array<{
      description: string;
      quantity: string | number;
      unitPrice: string | number;
      amount: string | number;
    }>;
    pdfAttachment?: {
      filename: string;
      content: Buffer;
    };
  }): Promise<boolean> {
    const formattedTotal = `${Number(options.total).toLocaleString()} ${options.currency}`;
    const formattedBalance = `${Number(options.balanceDue).toLocaleString()} ${options.currency}`;
    const subject = `Invoice ${options.invoiceNumber} from ${options.legalEntityName}`;

    const linesHtml = options.lines && options.lines.length > 0
      ? options.lines.map((line) => `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          <td style="padding: 10px 12px; color: #ffffff; font-size: 13px;">${line.description}</td>
          <td style="padding: 10px 12px; color: #a59cb8; font-size: 13px; text-align: center;">${line.quantity}</td>
          <td style="padding: 10px 12px; color: #a59cb8; font-size: 13px; text-align: right;">${Number(line.unitPrice).toLocaleString()} ${options.currency}</td>
          <td style="padding: 10px 12px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right;">${Number(line.amount).toLocaleString()} ${options.currency}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="4" style="padding: 12px; color: #8e849e; text-align: center;">Monthly Tech Services</td></tr>`;

    const bankDetailsHtml = options.bankDetails?.iban ? `
      <div style="background-color: #0b071d; border: 1px solid rgba(99, 50, 233, 0.3); border-radius: 8px; padding: 14px 18px; margin-top: 20px;">
        <h4 style="margin: 0 0 8px 0; color: #6332e9; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Remittance Wire Instructions</h4>
        <div style="font-size: 12px; color: #d3ccdc; line-height: 1.6;">
          ${options.bankDetails.bankName ? `<div><strong>Bank Name:</strong> ${options.bankDetails.bankName}</div>` : ""}
          <div><strong>IBAN:</strong> <span style="font-family: monospace; color: #ffffff;">${options.bankDetails.iban}</span></div>
          ${options.bankDetails.swiftBic ? `<div><strong>SWIFT / BIC:</strong> <span style="font-family: monospace; color: #ffffff;">${options.bankDetails.swiftBic}</span></div>` : ""}
          <div><strong>Reference:</strong> <span style="font-family: monospace; color: #0af095;">${options.invoiceNumber}</span></div>
        </div>
      </div>
    ` : "";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #05030e; color: #ffffff; padding: 40px 16px;">
        <div style="max-width: 620px; margin: 0 auto; background-color: #120c29; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 32px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 20px; margin-bottom: 24px;">
            <div>
              <span style="display: inline-block; background: #6332e9; color: #ffffff; font-weight: bold; font-size: 12px; padding: 3px 10px; border-radius: 6px;">CODERS HUB</span>
              <h2 style="margin: 8px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700;">Commercial Invoice</h2>
            </div>
            <div style="text-align: right;">
              <div style="font-family: monospace; color: #0af095; font-size: 16px; font-weight: bold;">${options.invoiceNumber}</div>
              <div style="color: #8e849e; font-size: 11px; margin-top: 4px;">Issue Date: ${options.issueDate || "Today"}</div>
            </div>
          </div>

          <!-- Greeting & Amount Card -->
          <p style="color: #e4dfed; font-size: 14px; margin: 0 0 16px 0;">
            Dear <strong>${options.companyName}</strong>,
          </p>
          <p style="color: #a59cb8; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;">
            Please find enclosed invoice <strong>${options.invoiceNumber}</strong> issued by <strong>${options.legalEntityName}</strong>.
          </p>

          <div style="background: linear-gradient(135deg, #1c143c 0%, #150f2f 100%); border: 1px solid #3d2d60; border-radius: 10px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <div style="color: #a59cb8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Total Amount Due</div>
            <div style="color: #0af095; font-size: 32px; font-weight: 800; margin: 6px 0;">${formattedBalance}</div>
            ${options.dueDate ? `<div style="color: #f7b928; font-size: 12px; font-weight: 600;">Due on: ${options.dueDate}</div>` : ""}
          </div>

          <!-- Line items summary -->
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 10px 0; color: #ffffff; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Summary of Services</h4>
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.15); background-color: #0a0618;">
                  <th style="padding: 8px 12px; color: #8e849e; font-size: 11px; text-transform: uppercase;">Description</th>
                  <th style="padding: 8px 12px; color: #8e849e; font-size: 11px; text-transform: uppercase; text-align: center;">Qty</th>
                  <th style="padding: 8px 12px; color: #8e849e; font-size: 11px; text-transform: uppercase; text-align: right;">Unit Price</th>
                  <th style="padding: 8px 12px; color: #8e849e; font-size: 11px; text-transform: uppercase; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml}
              </tbody>
            </table>
          </div>

          ${bankDetailsHtml}

          <!-- Footer notice -->
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 28px; padding-top: 18px; text-align: center; color: #766d86; font-size: 11px; line-height: 1.5;">
            Thank you for building high-performing software engineering teams with Coders Hub.<br />
            For any billing questions, reach us at <a href="mailto:finance@codershub.io" style="color: #6332e9; text-decoration: none;">finance@codershub.io</a>.
          </div>
        </div>
      </div>
    `;

    const text = `Invoice ${options.invoiceNumber} from ${options.legalEntityName}\n\n` +
      `Billed to: ${options.companyName}\n` +
      `Total Amount: ${formattedTotal}\n` +
      `Amount Due: ${formattedBalance}\n` +
      `Due Date: ${options.dueDate || "Upon receipt"}\n\n` +
      `Remittance Bank Wire Reference: ${options.invoiceNumber}\n` +
      (options.bankDetails?.iban ? `IBAN: ${options.bankDetails.iban}\n` : "") +
      (options.bankDetails?.swiftBic ? `SWIFT/BIC: ${options.bankDetails.swiftBic}\n\n` : "\n") +
      `Please remit payment by the due date. Thank you for your partnership with Coders Hub.`;

    const attachments = options.pdfAttachment
      ? [
          {
            filename: options.pdfAttachment.filename,
            content: options.pdfAttachment.content,
            contentType: "application/pdf",
          },
        ]
      : undefined;

    return this.sendMail({
      to: options.to,
      subject,
      text,
      html,
      attachments,
    });
  }

  async sendInvoiceReminderEmail(options: {
    to: string;
    invoiceNumber: string;
    companyName: string;
    currency: string;
    total: string;
    balanceDue: string;
    dueDate: string;
    daysOverdue: number;
    stage: string;
    legalEntityName: string;
    bankDetails?: {
      bankName?: string | null;
      iban?: string | null;
      swiftBic?: string | null;
    };
  }): Promise<boolean> {
    const formattedBalance = `${Number(options.balanceDue).toLocaleString()} ${options.currency}`;
    const isOverdue = options.daysOverdue > 0;
    const urgencyTitle = isOverdue
      ? `Overdue Payment Notice: ${options.daysOverdue} Days Past Due`
      : `Payment Reminder: Due Today`;

    const bannerColor = options.daysOverdue >= 10 ? "#ef4444" : options.daysOverdue > 0 ? "#f59e0b" : "#6332e9";
    const subject = `[Reminder] Invoice ${options.invoiceNumber} - ${urgencyTitle}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #05030e; color: #ffffff; padding: 40px 16px;">
        <div style="max-width: 620px; margin: 0 auto; background-color: #120c29; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 32px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);">
          <!-- Urgent Header Badge -->
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="display: inline-block; background-color: ${bannerColor}; color: #ffffff; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 20px;">
              ${urgencyTitle}
            </span>
          </div>

          <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 16px 0;">
            Payment Reminder: Invoice ${options.invoiceNumber}
          </h2>

          <p style="color: #e4dfed; font-size: 14px; margin: 0 0 14px 0;">
            Dear Finance Team at <strong>${options.companyName}</strong>,
          </p>
          <p style="color: #a59cb8; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
            This is a friendly reminder that invoice <strong>${options.invoiceNumber}</strong> issued by <strong>${options.legalEntityName}</strong> has an outstanding balance of <strong style="color: #0af095;">${formattedBalance}</strong> and was due on <strong>${options.dueDate}</strong>.
          </p>

          <div style="background: #181033; border: 1px solid ${bannerColor}; border-radius: 10px; padding: 18px; margin-bottom: 20px; text-align: center;">
            <div style="color: #a59cb8; font-size: 11px; text-transform: uppercase;">Outstanding Amount Due</div>
            <div style="color: #ffffff; font-size: 30px; font-weight: 800; margin: 4px 0;">${formattedBalance}</div>
            <div style="color: #a59cb8; font-size: 12px;">Invoice Due Date: <span style="color: #ffffff; font-weight: 600;">${options.dueDate}</span></div>
          </div>

          ${options.bankDetails?.iban ? `
            <div style="background-color: #0b071d; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
              <h4 style="margin: 0 0 8px 0; color: #a59cb8; font-size: 11px; text-transform: uppercase;">Wire Payment Coordinates</h4>
              <div style="font-size: 12px; color: #d3ccdc; line-height: 1.6;">
                ${options.bankDetails.bankName ? `<div><strong>Bank:</strong> ${options.bankDetails.bankName}</div>` : ""}
                <div><strong>IBAN:</strong> <span style="font-family: monospace; color: #ffffff;">${options.bankDetails.iban}</span></div>
                ${options.bankDetails.swiftBic ? `<div><strong>SWIFT:</strong> <span style="font-family: monospace; color: #ffffff;">${options.bankDetails.swiftBic}</span></div>` : ""}
                <div><strong>Reference:</strong> <span style="font-family: monospace; color: #0af095;">${options.invoiceNumber}</span></div>
              </div>
            </div>
          ` : ""}

          <p style="color: #a59cb8; font-size: 12px; line-height: 1.5; margin: 0 0 16px 0;">
            If you have already initiated this wire transfer, please let us know so we can reconcile your account. If you require an updated statement or have billing questions, feel free to contact us immediately.
          </p>

          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 24px; padding-top: 16px; text-align: center; color: #766d86; font-size: 11px;">
            Coders Hub Accounting &middot; <a href="mailto:finance@codershub.io" style="color: #6332e9; text-decoration: none;">finance@codershub.io</a>
          </div>
        </div>
      </div>
    `;

    const text = `PAYMENT REMINDER: Invoice ${options.invoiceNumber}\n\n` +
      `Company: ${options.companyName}\n` +
      `Amount Due: ${formattedBalance}\n` +
      `Due Date: ${options.dueDate} (${options.daysOverdue > 0 ? `${options.daysOverdue} days overdue` : "Due today"})\n\n` +
      `Please remit funds referencing ${options.invoiceNumber}.\n` +
      (options.bankDetails?.iban ? `IBAN: ${options.bankDetails.iban}\n` : "") +
      (options.bankDetails?.swiftBic ? `SWIFT: ${options.bankDetails.swiftBic}\n` : "");

    return this.sendMail({
      to: options.to,
      subject,
      text,
      html,
    });
  }
}
