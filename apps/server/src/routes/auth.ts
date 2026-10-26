import { Router } from "express";
import {
  AUTH_COOKIE_NAME,
  loginSchema,
  registerSchema,
  updateStatusSchema,
} from "@hivetalk/shared";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../lib/serialize.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginUser, registerUser } from "../services/authService.js";

export const authRouter = Router();

function cookieOptions() {
  const secure = env.COOKIE_SECURE || env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  } as const;
}

function setAuthCookie(res: import("express").Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
}

authRouter.post(
  "/register",
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const result = await registerUser(req.body);
      setAuthCookie(res, result.token);
      res.status(201).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    setAuthCookie(res, result.token);
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (_req, res) => {
  const { maxAge: _maxAge, ...clearOpts } = cookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOpts);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const full = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    res.json({ user: toPublicUser(full) });
  } catch (error) {
    next(error);
  }
});

authRouter.patch(
  "/me/status",
  requireAuth,
  validate(updateStatusSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          statusText: req.body.statusText,
          statusEmoji: req.body.statusEmoji,
        },
      });
      const io = req.app.get("io") as
        | { emit: (event: string, payload: unknown) => void }
        | undefined;
      if (io) {
        const { SOCKET_EVENTS } = await import("@hivetalk/shared");
        io.emit(SOCKET_EVENTS.STATUS_CHANGED, { user: toPublicUser(updated) });
      }
      res.json({ user: toPublicUser(updated) });
    } catch (error) {
      next(error);
    }
  },
);
