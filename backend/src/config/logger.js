import pino from "pino";

export function createLogger({ level = "info", environment = "development" } = {}) {
  return pino({
    level,
    base: {
      service: "pulseapi-backend",
      environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = createLogger({
  level: process.env.LOG_LEVEL,
  environment: process.env.NODE_ENV,
});

