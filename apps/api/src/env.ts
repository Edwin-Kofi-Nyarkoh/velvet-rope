import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PASSWORD_PEPPER: z.string().min(16),
  PAYSTACK_SECRET_KEY: z.string().min(8),
  PAYSTACK_CALLBACK_URL: z.string().url(),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(4000),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default("Velvet Rope <onboarding@resend.dev>"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);
