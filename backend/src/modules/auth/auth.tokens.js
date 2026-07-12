import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { AppError } from "../../common/errors/AppError.js";

export const REFRESH_COOKIE_NAME = "pulseapi_refresh";

export function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccessToken(userId, config) {
  return jwt.sign(
    { type: "access" },
    config.JWT_ACCESS_SECRET,
    {
      subject: userId,
      expiresIn: config.ACCESS_TOKEN_TTL,
      jwtid: randomUUID(),
    },
  );
}

export function createRefreshToken(userId, config) {
  const expiresAt = new Date(
    Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const token = jwt.sign(
    { type: "refresh" },
    config.JWT_REFRESH_SECRET,
    {
      subject: userId,
      expiresIn: `${config.REFRESH_TOKEN_TTL_DAYS}d`,
      jwtid: randomUUID(),
    },
  );

  return { token, expiresAt };
}

function verifyToken(token, secret, expectedType, invalidCode) {
  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload !== "object" ||
      payload.type !== expectedType ||
      typeof payload.sub !== "string"
    ) {
      throw new Error("Unexpected token payload");
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, "TOKEN_EXPIRED", "The authentication token has expired.");
    }

    throw new AppError(401, invalidCode, "The authentication token is invalid.");
  }
}

export function verifyAccessToken(token, config) {
  return verifyToken(token, config.JWT_ACCESS_SECRET, "access", "UNAUTHORIZED");
}

export function verifyRefreshToken(token, config) {
  return verifyToken(
    token,
    config.JWT_REFRESH_SECRET,
    "refresh",
    "INVALID_REFRESH_TOKEN",
  );
}

export function getRefreshCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function getRefreshCookieClearOptions(config) {
  const { maxAge: _maxAge, ...options } = getRefreshCookieOptions(config);
  return options;
}
