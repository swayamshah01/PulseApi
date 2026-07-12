import { Router } from "express";
import { AppError } from "../../common/errors/AppError.js";
import { sendSuccess } from "../../common/utils/responses.js";

export function createSystemRouter(database) {
  const router = Router();

  router.get("/health", (_request, response) => {
    return sendSuccess(response, {
      status: "ok",
      service: "pulseapi-backend",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/ready", async (_request, response, next) => {
    try {
      await database.$queryRaw`SELECT 1`;
      return sendSuccess(response, {
        status: "ready",
        database: "connected",
      });
    } catch (_error) {
      return next(
        new AppError(
          503,
          "SERVICE_UNAVAILABLE",
          "The service is not ready to accept traffic.",
        ),
      );
    }
  });

  return router;
}

