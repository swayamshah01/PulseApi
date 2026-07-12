import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../../common/errors/AppError.js";
import { authenticate } from "../../common/middleware/authenticate.js";
import { createAuthController } from "./auth.controller.js";
import { loginSchema, registerSchema, validateBody } from "./auth.schema.js";
import { createAuthService } from "./auth.service.js";

function createAuthRateLimiter({ windowMs, limit, message, skip }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    handler: (_request, _response, next) =>
      next(new AppError(429, "RATE_LIMITED", message)),
  });
}

export function createAuthRouter({ database, config }) {
  const router = Router();
  const service = createAuthService({ database, config });
  const controller = createAuthController({ service, config });
  const registerLimiter = createAuthRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: "Too many registration attempts. Please try again later.",
    skip: () => config.NODE_ENV === "test",
  });
  const loginLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many login attempts. Please try again later.",
    skip: () => config.NODE_ENV === "test",
  });

  router.post(
    "/register",
    registerLimiter,
    validateBody(registerSchema),
    controller.register,
  );
  router.post("/login", loginLimiter, validateBody(loginSchema), controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);
  router.get("/me", authenticate(config), controller.me);

  return router;
}
