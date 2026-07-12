import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const app = createApp({
  database: prisma,
  logger: silentLogger,
  frontendOrigin: env.FRONTEND_ORIGIN,
  authConfig: env,
});

const validUser = {
  name: "Swayam Shah",
  email: "swayam@example.com",
  password: "StrongPassword123!",
};

function getRefreshCookie(response) {
  return response.headers["set-cookie"].find((cookie) =>
    cookie.startsWith("pulseapi_refresh="),
  );
}

function getRawRefreshToken(cookie) {
  return cookie.split(";", 1)[0].split("=", 2)[1];
}

function register(user = validUser) {
  return request(app).post("/api/v1/auth/register").send(user);
}

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authentication API", () => {
  it("registers a user and returns a safe session", async () => {
    const response = await register().expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      name: "Swayam Shah",
      email: "swayam@example.com",
    });
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(getRefreshCookie(response)).toContain("HttpOnly");
  });

  it("rejects invalid registration data", async () => {
    const response = await register({ name: " ", email: "bad", password: "short" })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it("rejects a duplicate normalized email", async () => {
    await register().expect(201);
    const response = await register({ ...validUser, email: "SWAYAM@EXAMPLE.COM" })
      .expect(409);

    expect(response.body.error.code).toBe("USER_ALREADY_EXISTS");
  });

  it("logs in with valid credentials", async () => {
    await register().expect(201);
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe(validUser.email);
  });

  it.each([
    ["an incorrect password", { email: validUser.email, password: "WrongPassword" }],
    ["an unknown email", { email: "unknown@example.com", password: "WrongPassword" }],
  ])("returns the same public login error for %s", async (_label, credentials) => {
    await register().expect(201);
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send(credentials)
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "The email or password is incorrect.",
    });
  });

  it("returns the current user for a valid access token", async () => {
    const registration = await register().expect(201);
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${registration.body.data.accessToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      name: validUser.name,
      email: validUser.email,
    });
    expect(response.body.data.createdAt).toEqual(expect.any(String));
  });

  it("rejects /me without an access token", async () => {
    const response = await request(app).get("/api/v1/auth/me").expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects /me with an invalid access token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rotates refresh tokens and rejects reuse of the old token", async () => {
    const registration = await register().expect(201);
    const oldCookie = getRefreshCookie(registration);
    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", oldCookie)
      .expect(200);
    const newCookie = getRefreshCookie(refreshed);

    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    expect(getRawRefreshToken(newCookie)).not.toBe(getRawRefreshToken(oldCookie));

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", oldCookie)
      .expect(401);
    expect(reuse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("logs out successfully and rejects refresh afterward", async () => {
    const registration = await register().expect(201);
    const cookie = getRefreshCookie(registration);

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie)
      .expect(200);

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie)
      .expect(401);
    expect(refresh.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("returns logout success when no cookie exists", async () => {
    const response = await request(app).post("/api/v1/auth/logout").expect(200);
    expect(response.body.data.message).toBe("Logged out successfully.");
  });

  it("never returns password hashes", async () => {
    const registration = await register().expect(201);
    const serialized = JSON.stringify(registration.body);

    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain(validUser.password);
  });

  it("stores only a SHA-256 hash of the refresh token", async () => {
    const registration = await register().expect(201);
    const rawToken = getRawRefreshToken(getRefreshCookie(registration));
    const storedToken = await prisma.refreshToken.findFirstOrThrow();
    const expectedHash = createHash("sha256").update(rawToken).digest("hex");

    expect(storedToken.tokenHash).toBe(expectedHash);
    expect(storedToken.tokenHash).not.toBe(rawToken);
  });
});
