import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { env } from "../config/env.js";

function createPrismaClient() {
  if (env.TURSO_DATABASE_URL) {
    const adapter = new PrismaLibSQL({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

export const prisma = createPrismaClient();
