import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME } from "@hivetalk/shared";
import { AppError } from "../lib/errors.js";
import { verifyAuthToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() || null;
  }

  return null;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError(401, "Authentication required");
    }

    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, displayName: true },
    });

    if (!user) {
      throw new AppError(401, "Authentication required");
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, "Invalid or expired token"));
  }
}
