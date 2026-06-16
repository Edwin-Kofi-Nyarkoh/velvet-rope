import { z } from "zod";
import { roles, ticketKinds } from "./constants";

export const emailSchema = z.string().trim().email().max(255).toLowerCase();
export const passwordSchema = z.string().min(10).max(128);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(roles).default("ATTENDEE")
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  otp: z.string().length(6).optional()
});

export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(5000),
  categoryId: z.string().uuid(),
  venueName: z.string().trim().min(2).max(160),
  address: z.string().trim().min(2).max(240),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120).default("Ghana"),
  bannerUrl: z.string().url(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isPrivate: z.boolean().default(false)
});

export const createTicketTypeSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(ticketKinds),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("GHS"),
  quantity: z.number().int().positive(),
  salesStartAt: z.string().datetime().optional(),
  salesEndAt: z.string().datetime().optional()
});

export const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(10).optional(),
  client: z.enum(["server", "mobile_webview"]).default("server").optional(),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10)
      })
    )
    .min(1)
    .max(10)
    .optional()
}).refine((data) => Boolean(data.items?.length) || Boolean(data.ticketTypeId && data.quantity), {
  message: "Select at least one ticket."
});

export const invitationSchema = z.object({
  eventId: z.string().uuid(),
  email: emailSchema,
  recipientName: z.string().trim().min(2).max(120),
  message: z.string().trim().max(500).optional()
});

export const checkInSchema = z.object({
  qrCodePayload: z.string().min(24).max(500),
  gate: z.string().trim().max(80).optional()
});

export const nfcCheckInSchema = z.object({
  nfcToken: z.string().trim().min(12).max(180),
  gate: z.string().trim().max(80).optional()
});

export const socialAccountSchema = z.object({
  provider: z.enum(["FACEBOOK", "LINKEDIN", "X", "INSTAGRAM", "TIKTOK"]),
  handle: z.string().trim().min(2).max(80),
  displayName: z.string().trim().min(2).max(120),
  followerCount: z.number().int().nonnegative().default(0)
});

export const vipVerificationSchema = z.object({
  provider: z.enum(["FACEBOOK", "LINKEDIN", "X", "INSTAGRAM", "TIKTOK"]),
  handle: z.string().trim().min(2).max(80),
  evidenceUrl: z.string().url().optional()
});

export const vendorTransactionSchema = z.object({
  eventId: z.string().uuid(),
  vendorId: z.string().uuid(),
  description: z.string().trim().min(2).max(160),
  amount: z.number().positive().max(250000),
  currency: z.string().length(3).default("GHS")
});

export const eventMessageSchema = z.object({
  eventId: z.string().uuid(),
  audience: z.enum(["STAFF", "VENDORS", "ALL"]),
  subject: z.string().trim().min(2).max(140),
  body: z.string().trim().min(2).max(2000)
});

export const assignSeatSchema = z.object({
  seatId: z.string().uuid(),
  ticketId: z.string().uuid()
});
