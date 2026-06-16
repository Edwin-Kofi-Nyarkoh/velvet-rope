import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { Role, User } from "@prisma/client";
import { registerSchema, loginSchema } from "@velvet-rope/shared";
import { env } from "../env";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";
import { emailService } from "./email.service";
import { nanoid } from "nanoid";

const LOCK_AFTER_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const VERIFICATION_MINUTES = 10;

function passwordInput(password: string) {
  return `${password}${env.PASSWORD_PEPPER}`;
}

function signTokens(user: Pick<User, "id" | "email" | "role">) {
  const payload = { id: user.id, email: user.email, role: user.role };
  return {
    accessToken: jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" }),
    refreshToken: jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "30d" })
  };
}

function dashboardFor(role: Role) {
  if (role === "ORGANIZER" || role === "ADMIN" || role === "SUPER_ADMIN") return "/organizer";
  if (role === "STAFF") return "/scan";
  if (role === "VENDOR") return "/vendor";
  return "/dashboard";
}

export const authService = {
  async register(input: unknown) {
    const data = registerSchema.parse(input);
    if (data.role === "SUPER_ADMIN" || data.role === "ADMIN") {
      throw new AppError(403, "ROLE_NOT_ALLOWED", "Admin accounts must be provisioned by an existing admin.");
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, "EMAIL_EXISTS", "An account with this email already exists.");

    const passwordHash = await argon2.hash(passwordInput(data.password), {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        profile: { create: { fullName: data.fullName } }
      },
      include: { profile: true }
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await argon2.hash(code, {
      type: argon2.argon2id,
      memoryCost: 12288,
      timeCost: 2,
      parallelism: 1
    });

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        codeHash,
        expiresAt: new Date(Date.now() + VERIFICATION_MINUTES * 60 * 1000)
      }
    });

    await emailService.sendVerificationCode({
      email: user.email,
      fullName: user.profile?.fullName ?? data.fullName,
      code
    });

    return {
      verificationRequired: true,
      expiresInMinutes: VERIFICATION_MINUTES,
      redirectTo: `/verify-otp?email=${encodeURIComponent(user.email)}`,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.profile?.fullName ?? data.fullName }
    };
  },

  async login(input: unknown) {
    const data = loginSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { email: data.email }, include: { profile: true } });
    if (!user) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    if (!user.emailVerifiedAt) {
      throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before logging in.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(423, "ACCOUNT_LOCKED", "This account is temporarily locked after multiple failed attempts.");
    }

    const valid = await argon2.verify(user.passwordHash, passwordInput(data.password));
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= LOCK_AFTER_ATTEMPTS
              ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
              : null
        }
      });
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }
    });

    const tokens = signTokens(user);
    return {
      ...tokens,
      redirectTo: dashboardFor(user.role),
      user: { id: user.id, email: user.email, role: user.role, fullName: user.profile?.fullName ?? "Guest" }
    };
  },

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as Pick<User, "id" | "email" | "role">;
      const user = await prisma.user.findUnique({ where: { id: payload.id }, include: { profile: true } });
      if (!user) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Your refresh token is invalid.");
      if (!user.emailVerifiedAt) throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before continuing.");
      const tokens = signTokens(user);
      return {
        ...tokens,
        redirectTo: dashboardFor(user.role),
        user: { id: user.id, email: user.email, role: user.role, fullName: user.profile?.fullName ?? "Guest" }
      };
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Your refresh token is invalid or expired.");
    }
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    const safeResponse = { message: "If an account exists, a password reset link has been sent." };
    if (!user || !user.emailVerifiedAt) return safeResponse;

    const token = nanoid(40);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    emailService.sendPasswordReset({
      email: user.email,
      fullName: user.profile?.fullName ?? "there",
      token
    }).catch((error) => console.error("Password reset email failed", error));

    return safeResponse;
  },

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new AppError(422, "RESET_INVALID", "Token and new password are required.");
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new AppError(400, "INVALID_RESET_TOKEN", "This reset link is invalid or has expired.");
    }

    const passwordHash = await argon2.hash(`${newPassword}${env.PASSWORD_PEPPER}`, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
    ]);

    return { message: "Password updated. You can now log in with your new password." };
  },

  async verifyEmail(input: { email?: string; code?: string }) {
    if (!input.email || !input.code) {
      throw new AppError(422, "VERIFICATION_REQUIRED", "Email and verification code are required.");
    }

    const user = await prisma.user.findUnique({ where: { email: input.email }, include: { profile: true } });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "This verification request has expired. Please sign up again.");
    if (user.emailVerifiedAt) {
      const tokens = signTokens(user);
      return {
        ...tokens,
        redirectTo: dashboardFor(user.role),
        user: { id: user.id, email: user.email, role: user.role, fullName: user.profile?.fullName ?? "Guest" }
      };
    }

    const verification = await prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        consumedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (!verification || verification.expiresAt < new Date()) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw new AppError(410, "VERIFICATION_EXPIRED", "This code has expired. Please sign up again.");
    }

    const valid = await argon2.verify(verification.codeHash, input.code);
    if (!valid) throw new AppError(401, "INVALID_VERIFICATION_CODE", "Invalid verification code.");

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifications: {
          update: {
            where: { id: verification.id },
            data: { consumedAt: new Date() }
          }
        }
      },
      include: { profile: true }
    });

    const tokens = signTokens(verifiedUser);
    return {
      ...tokens,
      redirectTo: dashboardFor(verifiedUser.role),
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        role: verifiedUser.role,
        fullName: verifiedUser.profile?.fullName ?? "Guest"
      }
    };
  }
};
