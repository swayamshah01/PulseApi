import { AppError } from "../errors/AppError.js";

export function notFound(request, _response, next) {
  next(new AppError(404, "NOT_FOUND", `Route ${request.method} ${request.path} was not found.`));
}

