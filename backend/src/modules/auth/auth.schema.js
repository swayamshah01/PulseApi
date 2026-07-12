import { z } from "zod";
import { AppError } from "../../common/errors/AppError.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(128),
});

export function validateBody(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(
        new AppError(400, "VALIDATION_ERROR", "The request data is invalid.", details),
      );
    }

    request.validatedBody = result.data;
    return next();
  };
}
