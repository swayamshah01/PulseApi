import { AppError } from "../errors/AppError.js";
import { logger as defaultLogger } from "../../config/logger.js";

export function errorHandler(logger = defaultLogger) {
  return (error, request, response, _next) => {
    const isOperational = error instanceof AppError;
    const statusCode = isOperational ? error.statusCode : 500;
    const code = isOperational ? error.code : "INTERNAL_SERVER_ERROR";
    const message = isOperational ? error.message : "An unexpected error occurred.";
    const details = isOperational ? error.details : [];

    logger[statusCode >= 500 ? "error" : "warn"](
      {
        requestId: request.id,
        code,
        statusCode,
        error: isOperational
          ? { name: error.name, message: error.message }
          : { name: error.name, message: error.message, stack: error.stack },
      },
      "request failed",
    );

    response.status(statusCode).json({
      success: false,
      error: { code, message, details },
    });
  };
}

