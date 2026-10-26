import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env") });
loadEnv();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    /** Local SQLite file used by Prisma CLI (generate / migrate / db push). */
    DATABASE_URL: z.string().min(1).default("file:./prisma/dev.db"),
    /** Turso libSQL URL — when set, Prisma uses the libSQL driver adapter. */
    TURSO_DATABASE_URL: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url().optional(),
    ),
    TURSO_AUTH_TOKEN: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    CLIENT_ORIGIN: z.string().url(),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    /** Cross-site cookies (Vercel frontend → separate API host). */
    COOKIE_SAME_SITE: z.enum(["lax", "none", "strict"]).default("lax"),
  })
  .superRefine((data, ctx) => {
    if (data.TURSO_DATABASE_URL && !data.TURSO_AUTH_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TURSO_AUTH_TOKEN"],
        message: "TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set",
      });
    }
    if (data.COOKIE_SAME_SITE === "none" && !data.COOKIE_SECURE && data.NODE_ENV === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true when COOKIE_SAME_SITE=none",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
