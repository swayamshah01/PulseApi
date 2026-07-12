import { z } from "zod";
import { AppError } from "../../common/errors/AppError.js";

const historySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  result: z.enum(["all", "successful", "failed"]).default("all"),
});

const statsSchema = z.object({
  range: z.enum(["1h", "24h", "7d", "30d", "all"]).default("24h"),
});

function details(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function validateCheckHistoryQuery(request, _response, next) {
  const result = historySchema.safeParse(request.query);

  if (!result.success) {
    return next(new AppError(400, "VALIDATION_ERROR", "The history query is invalid.", details(result.error)));
  }
  if (result.data.from && result.data.to && result.data.from > result.data.to) {
    return next(new AppError(400, "VALIDATION_ERROR", "The history start date must be before the end date."));
  }

  request.validatedQuery = result.data;
  return next();
}

export function validateCheckStatsQuery(request, _response, next) {
  const result = statsSchema.safeParse(request.query);

  if (!result.success) {
    return next(new AppError(400, "VALIDATION_ERROR", "The statistics range is invalid.", details(result.error)));
  }

  request.validatedQuery = result.data;
  return next();
}
