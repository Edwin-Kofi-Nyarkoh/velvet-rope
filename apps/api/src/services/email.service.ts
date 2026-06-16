import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { env } from "../env";

const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    })
  : nodemailer.createTransport({
      jsonTransport: true
    });

export const emailService = {
  async sendVerificationCode(input: { email: string; fullName: string; code: string }) {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.email,
      subject: "Verify your Velvet Rope account",
      text: `Hi ${input.fullName}, your Velvet Rope verification code is ${input.code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Verify your Velvet Rope account</h2>
          <p>Hi ${input.fullName},</p>
          <p>Use this one-time code to verify your account. It expires in 10 minutes.</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.code}</p>
        </div>
      `
    });

    if (!hasSmtp) console.log("Development email queued:", info.messageId, "Verification code:", input.code);
  },

  async sendTicketConfirmation(input: {
    email: string;
    fullName: string;
    eventTitle: string;
    tickets: Array<{ code: string; ticketType: string; qrCodePayload: string }>;
  }) {
    const attachments = await Promise.all(
      input.tickets.map(async (ticket) => {
        const dataUrl = await QRCode.toDataURL(ticket.qrCodePayload, { margin: 1, width: 280 });
        return {
          filename: `${ticket.code}.png`,
          content: Buffer.from(dataUrl.split(",")[1] ?? "", "base64"),
          cid: `${ticket.code}@velvet-rope`
        };
      })
    );

    const ticketRows = input.tickets
      .map(
        (ticket) => `
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0">
            <p style="margin:0 0 6px;font-weight:700">${ticket.ticketType} ticket</p>
            <p style="margin:0 0 12px;color:#4b5563">Code: ${ticket.code}</p>
            <img src="cid:${ticket.code}@velvet-rope" alt="${ticket.code} QR code" width="160" height="160" />
          </div>
        `
      )
      .join("");

    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.email,
      subject: `Your Velvet Rope tickets for ${input.eventTitle}`,
      text: `Hi ${input.fullName}, your ${input.eventTitle} tickets are ready. Ticket codes: ${input.tickets.map((ticket) => ticket.code).join(", ")}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Your tickets are ready</h2>
          <p>Hi ${input.fullName},</p>
          <p>Your payment was confirmed. Use the QR code below at entry, and you can also view it inside your Velvet Rope account.</p>
          ${ticketRows}
        </div>
      `,
      attachments
    });

    if (!hasSmtp) console.log("Development ticket email queued:", info.messageId);
  },

  async sendPasswordReset(input: { email: string; fullName: string; token: string }) {
    const resetUrl = `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(input.token)}`;
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.email,
      subject: "Reset your Velvet Rope password",
      text: `Hi ${input.fullName}, click here to reset your password: ${resetUrl}. This link expires in 30 minutes. If you didn't request this, ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="color:#C9A84C">Reset your password</h2>
          <p>Hi ${input.fullName},</p>
          <p>Click the button below to reset your Velvet Rope password. This link expires in <strong>30 minutes</strong>.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#C9A84C;color:#0A0A0F;text-decoration:none;border-radius:10px;padding:14px 28px;font-weight:700;font-size:15px">
              Reset Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
        </div>
      `
    });
    if (!hasSmtp) console.log("Development password reset email queued:", info.messageId, resetUrl);
  },

  async sendInvitation(input: { email: string; recipientName: string; senderName: string; eventTitle: string; message?: string; token: string }) {
    const inviteUrl = `${env.WEB_APP_URL}/events?invite=${encodeURIComponent(input.token)}`;
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.email,
      subject: `${input.senderName} invited you to ${input.eventTitle}`,
      text: `${input.recipientName}, ${input.senderName} invited you to ${input.eventTitle}. ${input.message ?? ""} Respond here: ${inviteUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>You are invited</h2>
          <p>Hi ${input.recipientName},</p>
          <p>${input.senderName} invited you to <strong>${input.eventTitle}</strong>.</p>
          ${input.message ? `<p style="background:#f3f4f6;border-radius:10px;padding:12px">${input.message}</p>` : ""}
          <p><a href="${inviteUrl}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;border-radius:10px;padding:12px 16px">View invitation</a></p>
        </div>
      `
    });

    if (!hasSmtp) console.log("Development invitation email queued:", info.messageId, inviteUrl);
  }
};
