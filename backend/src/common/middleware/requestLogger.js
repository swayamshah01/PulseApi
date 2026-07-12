import { randomUUID } from "node:crypto";
import { logger as defaultLogger } from "../../config/logger.js";

function getRequestId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128
    ? value
    : randomUUID();
}

export function requestLogger(logger = defaultLogger) {
  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();
    request.id = getRequestId(request.get("x-request-id"));
    response.set("x-request-id", request.id);

    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      logger.info(
        {
          requestId: request.id,
          method: request.method,
          route: request.route?.path ?? request.path,
          statusCode: response.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          userId: request.user?.id,
        },
        "request completed",
      );
    });

    next();
  };
}

