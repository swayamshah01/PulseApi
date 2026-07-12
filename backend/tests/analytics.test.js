import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import { createAccessToken } from "../src/modules/auth/auth.tokens.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const app = createApp({ database: prisma, logger, authConfig: env });
let user;
let monitor;
let authorization;

async function createResult(overrides = {}, targetMonitor = monitor) {
  return prisma.checkResult.create({
    data: {
      monitorId: targetMonitor.id,
      checkedAt: new Date(),
      success: true,
      statusCode: 200,
      responseTimeMs: 100,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await prisma.checkResult.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  user = await prisma.user.create({
    data: { name: "Analytics Owner", email: "analytics@example.com", passwordHash: "unused" },
  });
  monitor = await prisma.monitor.create({
    data: { userId: user.id, name: "Analytics API", url: "https://analytics.example.com", nextCheckAt: new Date() },
  });
  authorization = `Bearer ${createAccessToken(user.id, env)}`;
});

afterAll(async () => prisma.$disconnect());

describe("check history", () => {
  it("paginates results newest first with metadata", async () => {
    await createResult({ checkedAt: new Date("2026-01-01T00:00:00Z") });
    await createResult({ checkedAt: new Date("2026-01-02T00:00:00Z") });
    await createResult({ checkedAt: new Date("2026-01-03T00:00:00Z") });

    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}/checks?page=1&limit=2`)
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(response.body.data[0].checkedAt).toContain("2026-01-03");
  });

  it("filters history by result and inclusive date range", async () => {
    await createResult({ checkedAt: new Date("2026-02-01T00:00:00Z") });
    await createResult({ checkedAt: new Date("2026-02-02T00:00:00Z"), success: false, statusCode: 500, errorType: "INVALID_STATUS" });
    await createResult({ checkedAt: new Date("2026-02-03T00:00:00Z"), success: false, statusCode: null, errorType: "TIMEOUT" });

    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}/checks?result=failed&from=2026-02-02T00:00:00Z&to=2026-02-02T23:59:59Z`)
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].errorType).toBe("INVALID_STATUS");
  });

  it("does not expose another user's history", async () => {
    const other = await prisma.user.create({
      data: { name: "Other", email: "other-analytics@example.com", passwordHash: "unused" },
    });
    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}/checks`)
      .set("Authorization", `Bearer ${createAccessToken(other.id, env)}`)
      .expect(404);
    expect(response.body.error.code).toBe("MONITOR_NOT_FOUND");
  });
});

describe("monitor statistics", () => {
  it("calculates uptime, counts, response times, and chart series", async () => {
    await createResult({ success: true, responseTimeMs: 100 });
    await createResult({ success: true, responseTimeMs: 200 });
    await createResult({ success: false, statusCode: 500, responseTimeMs: 400, errorType: "INVALID_STATUS" });
    await prisma.monitor.update({ where: { id: monitor.id }, data: { isUp: false } });

    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}/stats?range=24h`)
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toMatchObject({
      totalChecks: 3,
      successfulChecks: 2,
      failedChecks: 1,
      uptimePercentage: 66.67,
      averageResponseTimeMs: 233,
      minimumResponseTimeMs: 100,
      maximumResponseTimeMs: 400,
      currentStatus: "DOWN",
    });
    expect(response.body.data.series.length).toBeGreaterThan(0);
  });

  it("returns null metrics when no checks exist", async () => {
    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}/stats?range=all`)
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toMatchObject({
      totalChecks: 0,
      uptimePercentage: null,
      averageResponseTimeMs: null,
      minimumResponseTimeMs: null,
      maximumResponseTimeMs: null,
      currentStatus: "UNKNOWN",
    });
  });

  it("applies the selected statistics range", async () => {
    await createResult({ checkedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), responseTimeMs: 900 });
    await createResult({ checkedAt: new Date(), responseTimeMs: 100 });

    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}/stats?range=1h`)
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data.totalChecks).toBe(1);
    expect(response.body.data.averageResponseTimeMs).toBe(100);
  });
});

describe("dashboard summary", () => {
  it("returns user-scoped counts, average uptime, and recent failures", async () => {
    const second = await prisma.monitor.create({
      data: { userId: user.id, name: "Second API", url: "https://second.example.com", status: "PAUSED", isUp: true },
    });
    await prisma.monitor.update({ where: { id: monitor.id }, data: { isUp: false } });
    await createResult({ success: true }, monitor);
    await createResult({ success: false, statusCode: 500, errorType: "INVALID_STATUS" }, monitor);
    await createResult({ success: true }, second);
    await createResult({ success: true }, second);

    const other = await prisma.user.create({
      data: { name: "Other", email: "dashboard-other@example.com", passwordHash: "unused" },
    });
    const otherMonitor = await prisma.monitor.create({
      data: { userId: other.id, name: "Private Other", url: "https://other.example.com" },
    });
    await createResult({ success: false, errorType: "TIMEOUT" }, otherMonitor);

    const response = await request(app)
      .get("/api/v1/dashboard/summary")
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data.counts).toEqual({ total: 2, active: 1, paused: 1, up: 1, down: 1, unknown: 0 });
    expect(response.body.data.averageUptimePercentage).toBe(75);
    expect(response.body.data.recentFailures).toHaveLength(1);
    expect(response.body.data.recentFailures[0].monitorName).toBe("Analytics API");
  });

  it("returns an empty honest summary", async () => {
    await prisma.monitor.deleteMany();
    const response = await request(app)
      .get("/api/v1/dashboard/summary")
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data.counts.total).toBe(0);
    expect(response.body.data.averageUptimePercentage).toBeNull();
    expect(response.body.data.recentFailures).toEqual([]);
  });
});
