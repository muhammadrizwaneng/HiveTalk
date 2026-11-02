import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { createSocketServer } from "./sockets/index.js";

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);
  app.set("io", io);

  // Bind all interfaces so EC2 public IP can reach the API (not only localhost).
  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`HiveTalk server listening on http://0.0.0.0:${env.PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
