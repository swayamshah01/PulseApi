import { z } from "zod";
import { AppError } from "../../common/errors/AppError.js";

const allowedStatuses = ["ACTIVE", "PAUSED"];
const allowedSortFields = ["name", "createdAt", "updatedAt", "lastCheckedAt"];

const monitorUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048)
  .url("URL must be an absolute URL")
  .superRefine((value, context) => {
    try {
      const url = new URL(value);

      if (!["http:", "https:"].includes(url.protocol)) {
        context.addIssue({
          code: "custom",
          message: "URL must use the http or https protocol",
        });
      }

      if (url.username || url.password) {
        context.addIssue({
          code: "custom",
          message: "URL must not contain embedded credentials",
        });
      }
    } catch {
      // The URL validator above provides the public validation message.
    }
  })
  .transform((value) => {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  });

const monitorFields = {
  name: z.string().trim().min(2).max(100),
  url: monitorUrlSchema,
  expectedStatusCode: z.number().int().min(100).max(599),
  timeoutMs: z.number().int().min(1000).max(30000),
  intervalSeconds: z.number().int().min(60).max(86400),
};

export const createMonitorSchema = z.object({
  name: monitorFields.name,
  url: monitorFields.url,
  expectedStatusCode: monitorFields.expectedStatusCode.default(200),
  timeoutMs: monitorFields.timeoutMs.default(5000),
  intervalSeconds: monitorFields.intervalSeconds.default(300),
});

export const updateMonitorSchema = z
  .object({
    name: monitorFields.name.optional(),
    url: monitorFields.url.optional(),
    expectedStatusCode: monitorFields.expectedStatusCode.optional(),
    timeoutMs: monitorFields.timeoutMs.optional(),
    intervalSeconds: monitorFields.intervalSeconds.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable monitor field is required",
  });

const listMonitorSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(allowedStatuses).optional(),
  health: z.enum(["up", "down", "unknown"]).optional(),
  search: z.string().trim().max(2048).optional(),
  sortBy: z.enum(allowedSortFields).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

function validationDetails(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function validateMonitorBody(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      return next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "The monitor data is invalid.",
          validationDetails(result.error),
        ),
      );
    }

    request.validatedBody = result.data;
    return next();
  };
}

export function validateMonitorListQuery(request, _response, next) {
  if (request.query.status && !allowedStatuses.includes(request.query.status)) {
    return next(
      new AppError(400, "INVALID_MONITOR_STATUS", "The monitor status filter is invalid."),
    );
  }

  if (request.query.sortBy && !allowedSortFields.includes(request.query.sortBy)) {
    return next(
      new AppError(400, "INVALID_SORT_FIELD", "The monitor sort field is invalid."),
    );
  }

  const result = listMonitorSchema.safeParse(request.query);

  if (!result.success) {
    return next(
      new AppError(
        400,
        "VALIDATION_ERROR",
        "The monitor query is invalid.",
        validationDetails(result.error),
      ),
    );
  }

  request.validatedQuery = result.data;
  return next();
}
