import type { LoginInput, RegisterInput } from "@hivetalk/shared";
import { AppError } from "../lib/errors.js";
import { signAuthToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../lib/serialize.js";

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      passwordHash,
    },
  });

  const token = signAuthToken({ sub: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signAuthToken({ sub: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}
