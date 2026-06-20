import { Resend } from "resend";
import QRCode from "qrcode";
import { env } from "../env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

if (resend) {
  console.log(`[email] Resend configured — from=${env.EMAIL_FROM}`);
} else {
  console.warn("[email] RESEND_API_KEY not set — emails will be logged to console only");
}

async function send(payload: { to: string; subject: string; html: string; text: string; attachments?: Array<{ filename: string; content: Buffer; cid: string }> }) {
  if (!resend) {
    console.log(`[email] dev — to=${payload.to} subject="${payload.subject}"`);
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content
    }))
  });
  if (error) throw new Error(error.message);
}

export const emailService = {
  async sendVerificationCode(input: { email: string; fullName: string; code: string }) {
    await send({
      to: input.email,
      subject: "Verify your Velvet Rope account",
      text: `Hi ${input.fullName}, your Velvet Rope verification code is ${input.code}. It expires in 30 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">Verify your account</h2>
          <p>Hi ${input.fullName},</p>
          <p>Use this one-time code to verify your Velvet Rope account. It expires in <strong>30 minutes</strong>.</p>
          <p style="font-size:36px;font-weight:700;letter-spacing:10px;color:#C9A84C;margin:28px 0">${input.code}</p>
          <p style="color:#6b7280;font-size:13px">If you didn't create an account, ignore this email.</p>
        </div>
      `
    });
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
          </div>
        `
      )
      .join("");

    await send({
      to: input.email,
      subject: `Your Velvet Rope tickets for ${input.eventTitle}`,
      text: `Hi ${input.fullName}, your ${input.eventTitle} tickets are ready. Codes: ${input.tickets.map((t) => t.code).join(", ")}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">Your tickets are ready</h2>
          <p>Hi ${input.fullName},</p>
          <p>Your payment was confirmed. Show the QR code at entry.</p>
          ${ticketRows}
        </div>
      `,
      attachments
    });
  },

  async sendPasswordReset(input: { email: string; fullName: string; token: string }) {
    const resetUrl = `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(input.token)}`;
    await send({
      to: input.email,
      subject: "Reset your Velvet Rope password",
      text: `Hi ${input.fullName}, reset your password here: ${resetUrl}. Expires in 30 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">Reset your password</h2>
          <p>Hi ${input.fullName},</p>
          <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#C9A84C;color:#0A0A0F;text-decoration:none;border-radius:10px;padding:14px 28px;font-weight:700;font-size:15px">
              Reset Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">Didn't request this? You can safely ignore this email.</p>
        </div>
      `
    });
  },

  async sendCheckInConfirmation(input: {
    email: string;
    fullName: string;
    eventTitle: string;
    ticketCode: string;
    ticketType: string;
    checkedInAt: string;
    gate?: string;
  }) {
    await send({
      to: input.email,
      subject: `You're checked in — ${input.eventTitle}`,
      text: `Hi ${input.fullName}, you've been successfully checked in to ${input.eventTitle}. Ticket: ${input.ticketCode}${input.gate ? ` (Gate: ${input.gate})` : ""}. Checked in at: ${new Date(input.checkedInAt).toLocaleString()}.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">You're in!</h2>
          <p>Hi ${input.fullName},</p>
          <p>You have been successfully checked in to <strong>${input.eventTitle}</strong>.</p>
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0">
            <p style="margin:0 0 6px;font-weight:700">${input.ticketType}</p>
            <p style="margin:0 0 4px;color:#4b5563;font-size:14px">Ticket code: <strong>${input.ticketCode}</strong></p>
            ${input.gate ? `<p style="margin:0 0 4px;color:#4b5563;font-size:14px">Gate: ${input.gate}</p>` : ""}
            <p style="margin:0;color:#9ca3af;font-size:12px">Checked in at ${new Date(input.checkedInAt).toLocaleString()}</p>
          </div>
          <p style="color:#6b7280;font-size:13px">Enjoy the event!</p>
        </div>
      `
    });
  },

  async sendInvitation(input: {
    email: string;
    recipientName: string;
    senderName: string;
    eventTitle: string;
    message?: string;
    token: string;
  }) {
    const inviteUrl = `${env.WEB_APP_URL}/events?invite=${encodeURIComponent(input.token)}`;
    await send({
      to: input.email,
      subject: `${input.senderName} invited you to ${input.eventTitle}`,
      text: `${input.recipientName}, ${input.senderName} invited you to ${input.eventTitle}. ${input.message ?? ""} Respond: ${inviteUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:0 auto">
          <h2>You're invited</h2>
          <p>Hi ${input.recipientName},</p>
          <p>${input.senderName} invited you to <strong>${input.eventTitle}</strong>.</p>
          ${input.message ? `<p style="background:#f3f4f6;border-radius:10px;padding:12px">${input.message}</p>` : ""}
          <p>
            <a href="${inviteUrl}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;border-radius:10px;padding:12px 20px;font-weight:700">
              View invitation
            </a>
          </p>
        </div>
      `
    });
  }
};
