import type { Socket } from "socket.io";
import { AUTH_COOKIE_NAME } from "@hivetalk/shared";
import { verifyAuthToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface AuthedSocketData {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey || rest.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const cookies = parseCookieHeader(socket.request.headers.cookie);
    const cookieToken = cookies[AUTH_COOKIE_NAME];
    const authToken =
      typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : null;
    const token = cookieToken || authToken;

    if (!token) {
      next(new Error("Authentication required"));
      return;
    }

    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, displayName: true },
    });

    if (!user) {
      next(new Error("Authentication required"));
      return;
    }

    (socket.data as AuthedSocketData).user = user;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
