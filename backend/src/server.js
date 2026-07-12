import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { createMonitorScheduler } from "./scheduler/monitor.scheduler.js";

const app = createApp({
  database: prisma,
  logger,
  frontendOrigin: env.FRONTEND_ORIGIN,
  authConfig: env,
});
const scheduler = createMonitorScheduler({
  database: prisma,
  checkService: app.locals.checkService,
  logger,
  config: env,
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "PulseAPI backend started");
  scheduler.start().catch((error) => {
    logger.error({ error }, "initial scheduler cycle failed");
  });
});

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down");
  scheduler.stop();

  server.close(async (error) => {
    await prisma.$disconnect();

    if (error) {
      logger.error({ error }, "HTTP server shutdown failed");
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
