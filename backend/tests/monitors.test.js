import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import { createAccessToken } from "../src/modules/auth/auth.tokens.js";

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

const validMonitor = {
  name: "Production User API",
  url: "https://api.example.com/users#documentation",
  expectedStatusCode: 200,
  timeoutMs: 5000,
  intervalSeconds: 300,
};

let user;
let project;
let authorization;

async function createUser(email = "owner@example.com") {
  return prisma.user.create({
    data: {
      name: "Monitor Owner",
      email,
      passwordHash: "not-used-by-monitor-tests",
    },
  });
}

function bearerFor(userId) {
  return `Bearer ${createAccessToken(userId, env)}`;
}

function createMonitor(input = validMonitor, bearer = authorization) {
  return request(app)
    .post("/api/v1/monitors")
    .set("Authorization", bearer)
    .send(input);
}

async function seedMonitor(ownerId = user.id, overrides = {}) {
  const ownerProject = ownerId === user.id
    ? project
    : await prisma.project.upsert({
        where: { userId_name: { userId: ownerId, name: "Test project" } },
        update: {},
        create: { userId: ownerId, name: "Test project" },
      });
  return prisma.monitor.create({
    data: {
      userId: ownerId,
      projectId: ownerProject.id,
      name: "Seeded Monitor",
      url: "https://seed.example.com/",
      nextCheckAt: new Date(),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  user = await createUser();
  project = await prisma.project.create({ data: { userId: user.id, name: "Test project" } });
  authorization = bearerFor(user.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("monitor management API", () => {
  it("creates a monitor without making an endpoint check", async () => {
    const response = await createMonitor().expect(201);
    const stored = await prisma.monitor.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });

    expect(response.body.data).toMatchObject({
      name: validMonitor.name,
      method: "GET",
      status: "ACTIVE",
      isUp: null,
      consecutiveFailures: 0,
    });
    expect(stored.lastCheckedAt).toBeNull();
    expect(stored.nextCheckAt).toBeInstanceOf(Date);
  });

  it("rejects monitor creation without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/monitors")
      .send(validMonitor)
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(await prisma.monitor.count()).toBe(0);
  });

  it("validates monitor input", async () => {
    const response = await createMonitor({
      name: " ",
      url: "not-a-url",
      expectedStatusCode: 99,
      timeoutMs: 500,
      intervalSeconds: 10,
    }).expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThanOrEqual(5);
    expect(await prisma.monitor.count()).toBe(0);
  });

  it("rejects unsupported URL protocols", async () => {
    const response = await createMonitor({
      ...validMonitor,
      url: "ftp://example.com/file",
    }).expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.monitor.count()).toBe(0);
  });

  it("rejects embedded URL credentials", async () => {
    const response = await createMonitor({
      ...validMonitor,
      url: "https://username:password@example.com/private",
    }).expect(400);

    expect(response.body.error.details[0].message).toContain("credentials");
    expect(await prisma.monitor.count()).toBe(0);
  });

  it("applies default configuration values", async () => {
    const response = await createMonitor({
      name: "Defaults Monitor",
      url: "https://defaults.example.com",
    }).expect(201);
    const stored = await prisma.monitor.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });

    expect(stored).toMatchObject({
      expectedStatusCode: 200,
      timeoutMs: 5000,
      intervalSeconds: 300,
      status: "ACTIVE",
    });
  });

  it("forces method to GET even when the client supplies another method", async () => {
    const response = await createMonitor({
      ...validMonitor,
      method: "POST",
    }).expect(201);
    const stored = await prisma.monitor.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });

    expect(response.body.data.method).toBe("GET");
    expect(stored.method).toBe("GET");
  });

  it("removes URL fragments before storage", async () => {
    const response = await createMonitor().expect(201);
    const stored = await prisma.monitor.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });

    expect(stored.url).toBe("https://api.example.com/users");
  });

  it("enforces the 20-monitor limit", async () => {
    await prisma.monitor.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        userId: user.id,
        projectId: project.id,
        name: `Monitor ${index + 1}`,
        url: `https://limit-${index + 1}.example.com/`,
      })),
    });

    const response = await createMonitor().expect(409);
    expect(response.body.error.code).toBe("MONITOR_LIMIT_REACHED");
    expect(await prisma.monitor.count({ where: { userId: user.id } })).toBe(20);
  });

  it("lists only the authenticated user's monitors", async () => {
    const otherUser = await createUser("other@example.com");
    await seedMonitor(user.id, { name: "Owned Monitor" });
    await seedMonitor(otherUser.id, { name: "Other Monitor" });

    const response = await request(app)
      .get("/api/v1/monitors")
      .set("Authorization", authorization)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Owned Monitor");
  });

  it("returns pagination metadata", async () => {
    await Promise.all([
      seedMonitor(user.id, { name: "One", url: "https://one.example.com" }),
      seedMonitor(user.id, { name: "Two", url: "https://two.example.com" }),
      seedMonitor(user.id, { name: "Three", url: "https://three.example.com" }),
    ]);

    const response = await request(app)
      .get("/api/v1/monitors?page=2&limit=2")
      .set("Authorization", authorization)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("filters by ACTIVE and PAUSED status", async () => {
    await seedMonitor(user.id, { name: "Active", status: "ACTIVE" });
    await seedMonitor(user.id, { name: "Paused", status: "PAUSED" });

    const active = await request(app)
      .get("/api/v1/monitors?status=ACTIVE")
      .set("Authorization", authorization)
      .expect(200);
    const paused = await request(app)
      .get("/api/v1/monitors?status=PAUSED")
      .set("Authorization", authorization)
      .expect(200);

    expect(active.body.data.map((monitor) => monitor.name)).toEqual(["Active"]);
    expect(paused.body.data.map((monitor) => monitor.name)).toEqual(["Paused"]);
  });

  it("uses a specific error for invalid status filters", async () => {
    const response = await request(app)
      .get("/api/v1/monitors?status=INVALID")
      .set("Authorization", authorization)
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_MONITOR_STATUS");
  });

  it("filters by up, down, and unknown health", async () => {
    await seedMonitor(user.id, { name: "Up", isUp: true });
    await seedMonitor(user.id, { name: "Down", isUp: false });
    await seedMonitor(user.id, { name: "Unknown", isUp: null });

    for (const [health, expected] of [
      ["up", "Up"],
      ["down", "Down"],
      ["unknown", "Unknown"],
    ]) {
      const response = await request(app)
        .get(`/api/v1/monitors?health=${health}`)
        .set("Authorization", authorization)
        .expect(200);
      expect(response.body.data.map((monitor) => monitor.name)).toEqual([expected]);
    }
  });

  it("searches monitor names case-insensitively", async () => {
    await seedMonitor(user.id, { name: "Production Billing API" });
    await seedMonitor(user.id, { name: "Staging Users" });

    const response = await request(app)
      .get("/api/v1/monitors?search=production")
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data.map((monitor) => monitor.name)).toEqual([
      "Production Billing API",
    ]);
  });

  it("searches monitor URLs case-insensitively", async () => {
    await seedMonitor(user.id, { url: "https://api.example.com/SpecialPath" });
    await seedMonitor(user.id, { url: "https://unrelated.test/" });

    const response = await request(app)
      .get("/api/v1/monitors?search=specialpath")
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].url).toContain("SpecialPath");
  });

  it("sorts results using allowed fields", async () => {
    await seedMonitor(user.id, { name: "Zulu" });
    await seedMonitor(user.id, { name: "Alpha" });

    const response = await request(app)
      .get("/api/v1/monitors?sortBy=name&sortOrder=asc")
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data.map((monitor) => monitor.name)).toEqual([
      "Alpha",
      "Zulu",
    ]);
  });

  it("uses a specific error for invalid sort fields", async () => {
    const response = await request(app)
      .get("/api/v1/monitors?sortBy=userId")
      .set("Authorization", authorization)
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_SORT_FIELD");
  });

  it("gets one owned monitor", async () => {
    const monitor = await seedMonitor();
    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .expect(200);

    expect(response.body.data.id).toBe(monitor.id);
    expect(response.body.data.userId).toBeUndefined();
  });

  it("does not reveal another user's monitor", async () => {
    const otherUser = await createUser("other@example.com");
    const monitor = await seedMonitor(otherUser.id);
    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .expect(404);

    expect(response.body.error.code).toBe("MONITOR_NOT_FOUND");
  });

  it("updates permitted fields", async () => {
    const monitor = await seedMonitor();
    const response = await request(app)
      .patch(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .send({
        name: "Updated Monitor",
        expectedStatusCode: 204,
        timeoutMs: 8000,
      })
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(response.body.data).toMatchObject({
      name: "Updated Monitor",
      expectedStatusCode: 204,
      timeoutMs: 8000,
    });
    expect(stored.name).toBe("Updated Monitor");
  });

  it("prevents protected fields from being changed", async () => {
    const otherUser = await createUser("other@example.com");
    const monitor = await seedMonitor();

    await request(app)
      .patch(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .send({
        name: "Allowed Name",
        userId: otherUser.id,
        method: "POST",
        isUp: true,
        consecutiveFailures: 99,
        createdAt: "2000-01-01T00:00:00.000Z",
      })
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(stored).toMatchObject({
      userId: user.id,
      method: "GET",
      isUp: null,
      consecutiveFailures: 0,
    });
    expect(stored.createdAt.getUTCFullYear()).not.toBe(2000);
  });

  it("sets nextCheckAt when the URL changes", async () => {
    const previous = new Date("2020-01-01T00:00:00.000Z");
    const monitor = await seedMonitor(user.id, { nextCheckAt: previous });

    await request(app)
      .patch(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .send({ url: "https://changed.example.com/path#fragment" })
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(stored.url).toBe("https://changed.example.com/path");
    expect(stored.nextCheckAt.getTime()).toBeGreaterThan(previous.getTime());
  });

  it("sets nextCheckAt when the interval changes", async () => {
    const previous = new Date("2020-01-01T00:00:00.000Z");
    const monitor = await seedMonitor(user.id, { nextCheckAt: previous });

    await request(app)
      .patch(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .send({ intervalSeconds: 600 })
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(stored.intervalSeconds).toBe(600);
    expect(stored.nextCheckAt.getTime()).toBeGreaterThan(previous.getTime());
  });

  it("pauses a monitor", async () => {
    const monitor = await seedMonitor();
    const response = await request(app)
      .post(`/api/v1/monitors/${monitor.id}/pause`)
      .set("Authorization", authorization)
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(response.body.data).toMatchObject({ status: "PAUSED", nextCheckAt: null });
    expect(stored.status).toBe("PAUSED");
    expect(stored.nextCheckAt).toBeNull();
  });

  it("pauses an already paused monitor idempotently", async () => {
    const monitor = await seedMonitor(user.id, { status: "PAUSED", nextCheckAt: null });
    await request(app)
      .post(`/api/v1/monitors/${monitor.id}/pause`)
      .set("Authorization", authorization)
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });
    expect(stored.status).toBe("PAUSED");
    expect(stored.nextCheckAt).toBeNull();
  });

  it("resumes a paused monitor without running a check", async () => {
    const monitor = await seedMonitor(user.id, { status: "PAUSED", nextCheckAt: null });
    const response = await request(app)
      .post(`/api/v1/monitors/${monitor.id}/resume`)
      .set("Authorization", authorization)
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(response.body.data.status).toBe("ACTIVE");
    expect(stored.nextCheckAt).toBeInstanceOf(Date);
    expect(stored.lastCheckedAt).toBeNull();
  });

  it("resumes an already active monitor idempotently", async () => {
    const monitor = await seedMonitor();
    await request(app)
      .post(`/api/v1/monitors/${monitor.id}/resume`)
      .set("Authorization", authorization)
      .expect(200);
    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });
    expect(stored.status).toBe("ACTIVE");
    expect(stored.nextCheckAt).toBeInstanceOf(Date);
  });

  it("deletes an owned monitor with no response body", async () => {
    const monitor = await seedMonitor();
    const response = await request(app)
      .delete(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .expect(204);

    expect(response.text).toBe("");
    expect(await prisma.monitor.findUnique({ where: { id: monitor.id } })).toBeNull();
  });

  it("returns 404 after deletion", async () => {
    const monitor = await seedMonitor();
    await prisma.monitor.delete({ where: { id: monitor.id } });

    const response = await request(app)
      .get(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .expect(404);
    expect(response.body.error.code).toBe("MONITOR_NOT_FOUND");
  });

  it("prevents cross-user updates and deletes", async () => {
    const otherUser = await createUser("other@example.com");
    const monitor = await seedMonitor(otherUser.id);

    await request(app)
      .patch(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .send({ name: "Stolen Monitor" })
      .expect(404);
    await request(app)
      .delete(`/api/v1/monitors/${monitor.id}`)
      .set("Authorization", authorization)
      .expect(404);

    const stored = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });
    expect(stored.name).toBe("Seeded Monitor");
  });
});
