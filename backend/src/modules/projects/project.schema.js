import { z } from "zod";
import { AppError } from "../../common/errors/AppError.js";

const fields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).transform((value) => value || null).optional(),
};

export const createProjectSchema = z.object(fields);
export const updateProjectSchema = z
  .object({ name: fields.name.optional(), description: fields.description })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one project field is required",
  });

const listProjectSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

function details(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function validateProjectBody(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return next(new AppError(400, "VALIDATION_ERROR", "The project data is invalid.", details(result.error)));
    }
    request.validatedBody = result.data;
    return next();
  };
}

export function validateProjectListQuery(request, _response, next) {
  const result = listProjectSchema.safeParse(request.query);
  if (!result.success) {
    return next(new AppError(400, "VALIDATION_ERROR", "The project query is invalid.", details(result.error)));
  }
  request.validatedQuery = result.data;
  return next();
}
