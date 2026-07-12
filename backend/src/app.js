import cors from "cors";
import express from "express";
import { errorHandler } from "./common/middleware/errorHandler.js";
import { notFound } from "./common/middleware/notFound.js";
import { requestLogger } from "./common/middleware/requestLogger.js";
import { logger as defaultLogger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { createSystemRouter } from "./modules/system/system.routes.js";

export function createApp({
  database = prisma,
  logger = defaultLogger,
  frontendOrigin,
} = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: frontendOrigin ?? false }));
  app.use(express.json({ limit: "100kb" }));
  app.use(requestLogger(logger));
  app.use(createSystemRouter(database));
  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}

