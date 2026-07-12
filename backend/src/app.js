import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./common/middleware/errorHandler.js";
import { notFound } from "./common/middleware/notFound.js";
import { requestLogger } from "./common/middleware/requestLogger.js";
import { logger as defaultLogger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { env as defaultEnv } from "./config/env.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createCheckService } from "./modules/checks/check.service.js";
import { createMonitorRouter } from "./modules/monitors/monitor.routes.js";
import { createSystemRouter } from "./modules/system/system.routes.js";

export function createApp({
  database = prisma,
  logger = defaultLogger,
  frontendOrigin,
  authConfig = defaultEnv,
  checkHttpClient,
} = {}) {
  const app = express();
  const checkService = createCheckService({
    database,
    logger,
    httpClient: checkHttpClient,
  });
  app.locals.checkService = checkService;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: frontendOrigin ?? false, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(requestLogger(logger));
  app.use(createSystemRouter(database));
  app.use("/api/v1/auth", createAuthRouter({ database, config: authConfig }));
  app.use(
    "/api/v1/monitors",
    createMonitorRouter({ database, config: authConfig, checkService }),
  );
  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
