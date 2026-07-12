import { AppError } from "../errors/AppError.js";
import { verifyAccessToken } from "../../modules/auth/auth.tokens.js";

export function authenticate(config) {
  return (request, _response, next) => {
    const authorization = request.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      return next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
    }

    try {
      const payload = verifyAccessToken(token, config);
      request.user = { id: payload.sub };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
