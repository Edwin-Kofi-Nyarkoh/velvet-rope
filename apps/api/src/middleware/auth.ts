import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../env";
import { AppError } from "../lib/http";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  tv: number;
};

export type AuthRequest = Request & {
  user: AuthUser;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new AppError(401, "UNAUTHENTICATED", "Authentication is required."));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    (req as AuthRequest).user = payload;
    return next();
  } catch {
    return next(new AppError(401, "INVALID_TOKEN", "Your session is invalid or expired."));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (!user || !roles.includes(user.role)) {
      return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    }
    return next();
  };
}
