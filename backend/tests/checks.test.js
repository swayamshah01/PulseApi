import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import { createAccessToken } from "../src/modules/auth/auth.tokens.js";
import { UrlSecurityError } from "../src/security/url-validator.js";

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let httpBehavior;
let receivedOptions;
const checkHttpClient = async (url, options) => {
  receivedOptions = { url, ...options };
  return httpBehavior(url, options);
};
const app = createApp({
  database: prisma,
  logger: silentLogger,
  frontendOrigin: env.FRONTEND_ORIGIN,
  authConfig: env,
  checkHttpClient,
});

let user;
let project;
let monitor;
let authorization;

async function seed() {
  user = await prisma.user.create({
    data: { name: "Check Owner", email: "checks@example.com", passwordHash: "unused" },
  });
  project = await prisma.project.create({
    data: { userId: user.id, name: "Checks project" },
  });
  monitor = await prisma.monitor.create({
    data: {
      userId: user.id,
      projectId: project.id,
      name: "Checked API",
      url: "https://api.example.com/health",
      expectedStatusCode: 200,
      timeoutMs: 4321,
      intervalSeconds: 300,
      nextCheckAt: new Date(),
    },
  });
  authorization = `Bearer ${createAccessToken(user.id, env)}`;
}

function runCheck(id = monitor.id, bearer = authorization) {
  return request(app)
    .post(`/api/v1/monitors/${id}/check`)
    .set("Authorization", bearer);
}

beforeEach(async () => {
  await prisma.checkResult.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  httpBehavior = async () => ({ statusCode: 200, responseSizeBytes: 42 });
  receivedOptions = null;
  await seed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("manual endpoint checking", () => {
  it("stores a successful result and updates monitor summary", async () => {
    const response = await runCheck().expect(200);
    const storedResult = await prisma.checkResult.findFirstOrThrow();
    const storedMonitor = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(response.body.data).toMatchObject({
      success: true,
      statusCode: 200,
      errorType: null,
      responseSizeBytes: 42,
    });
    expect(storedResult.success).toBe(true);
    expect(storedMonitor).toMatchObject({
      isUp: true,
      lastStatusCode: 200,
      consecutiveFailures: 0,
    });
    expect(storedMonitor.lastCheckedAt).toBeInstanceOf(Date);
  });

  it("uses the monitor's configured timeout", async () => {
    await runCheck().expect(200);
    expect(receivedOptions.timeoutMs).toBe(4321);
    expect(receivedOptions.url).toBe(monitor.url);
  });

  it("records unexpected status codes as INVALID_STATUS", async () => {
    httpBehavior = async () => ({ statusCode: 503, responseSizeBytes: 12 });
    const response = await runCheck().expect(200);
    const storedMonitor = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(response.body.data).toMatchObject({
      success: false,
      statusCode: 503,
      errorType: "INVALID_STATUS",
    });
    expect(storedMonitor.isUp).toBe(false);
    expect(storedMonitor.consecutiveFailures).toBe(1);
  });

  it.each([
    ["TIMEOUT", { name: "TimeoutError" }],
    ["DNS", { code: "ENOTFOUND" }],
    ["NETWORK", { code: "ECONNREFUSED" }],
    ["NETWORK", { code: "EACCES" }],
    ["SSL", { code: "CERT_HAS_EXPIRED" }],
  ])("classifies and persists %s failures", async (errorType, properties) => {
    httpBehavior = async () => {
      throw Object.assign(new Error("technical detail"), properties);
    };

    const response = await runCheck().expect(200);
    const stored = await prisma.checkResult.findFirstOrThrow();
    expect(response.body.data.errorType).toBe(errorType);
    expect(stored.errorType).toBe(errorType);
    expect(stored.statusCode).toBeNull();
  });

  it("records blocked destinations without sending a request", async () => {
    httpBehavior = async () => {
      throw new UrlSecurityError("private address");
    };

    const response = await runCheck().expect(200);
    expect(response.body.data.errorType).toBe("BLOCKED_URL");
    expect(await prisma.checkResult.count()).toBe(1);
  });

  it("increments consecutive failures and resets them after recovery", async () => {
    httpBehavior = async () => ({ statusCode: 500, responseSizeBytes: 0 });
    await runCheck().expect(200);
    await runCheck().expect(200);
    expect((await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).consecutiveFailures).toBe(2);

    httpBehavior = async () => ({ statusCode: 200, responseSizeBytes: 0 });
    await runCheck().expect(200);
    expect((await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).consecutiveFailures).toBe(0);
    expect(await prisma.checkResult.count()).toBe(3);
  });

  it("keeps nextCheckAt null for a paused monitor", async () => {
    await prisma.monitor.update({
      where: { id: monitor.id },
      data: { status: "PAUSED", nextCheckAt: null },
    });
    await runCheck().expect(200);
    expect((await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).nextCheckAt).toBeNull();
  });

  it("prevents checks against another user's monitor", async () => {
    const other = await prisma.user.create({
      data: { name: "Other", email: "other-check@example.com", passwordHash: "unused" },
    });
    const response = await runCheck(monitor.id, `Bearer ${createAccessToken(other.id, env)}`).expect(404);
    expect(response.body.error.code).toBe("MONITOR_NOT_FOUND");
    expect(await prisma.checkResult.count()).toBe(0);
  });

  it("rejects a duplicate in-flight check", async () => {
    let release;
    httpBehavior = () => new Promise((resolve) => {
      release = () => resolve({ statusCode: 200, responseSizeBytes: 0 });
    });

    const first = runCheck().then((response) => response);
    while (!release) await new Promise((resolve) => setImmediate(resolve));
    const duplicate = await runCheck().expect(409);
    expect(duplicate.body.error.code).toBe("CHECK_ALREADY_RUNNING");
    release();
    await first;
    expect(await prisma.checkResult.count()).toBe(1);
  });
});
