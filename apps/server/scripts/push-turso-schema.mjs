/**
 * Push Prisma schema SQL to Turso.
 * Usage (from repo root, with TURSO_* in .env):
 *   node apps/server/scripts/push-turso-schema.mjs
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, "apps/server/.env") });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env first.");
  process.exit(1);
}

const schemaPath = path.join(root, "apps/server/prisma/schema.prisma");
const sql = execSync(
  `npx prisma migrate diff --from-empty --to-schema-datamodel "${schemaPath}" --script`,
  { cwd: path.join(root, "apps/server"), encoding: "utf8", env: process.env },
);

const client = createClient({ url, authToken });
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Applying ${statements.length} statements to Turso...`);
for (const statement of statements) {
  try {
    await client.execute(statement);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/already exists/i.test(msg)) {
      console.warn("skip (exists):", statement.slice(0, 60).replace(/\s+/g, " "));
      continue;
    }
    console.error("Failed:", statement.slice(0, 120));
    throw err;
  }
}
console.log("Turso schema sync complete.");
