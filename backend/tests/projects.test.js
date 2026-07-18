import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import { createAccessToken } from "../src/modules/auth/auth.tokens.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const app = createApp({ database: prisma, logger, authConfig: env });
let user;
let authorization;

function bearer(userId) {
  return `Bearer ${createAccessToken(userId, env)}`;
}

function createProject(input = { name: "Commerce API", description: "Production commerce services" }) {
  return request(app)
    .post("/api/v1/projects")
    .set("Authorization", authorization)
    .send(input);
}

beforeEach(async () => {
  await prisma.checkResult.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  user = await prisma.user.create({
    data: { name: "Project Owner", email: "projects@example.com", passwordHash: "unused" },
  });
  authorization = bearer(user.id);
});

afterAll(async () => prisma.$disconnect());

describe("project and endpoint hierarchy", () => {
  it("creates and returns an empty project", async () => {
    const response = await createProject().expect(201);
    expect(response.body.data).toMatchObject({
      name: "Commerce API",
      description: "Production commerce services",
      health: "EMPTY",
      endpointCounts: { total: 0, active: 0, paused: 0, up: 0, down: 0, unknown: 0 },
    });
    expect(await prisma.project.count({ where: { userId: user.id } })).toBe(1);
  });

  it("validates project input and rejects duplicate names", async () => {
    await createProject().expect(201);
    const duplicate = await createProject().expect(409);
    expect(duplicate.body.error.code).toBe("PROJECT_ALREADY_EXISTS");
    const invalid = await createProject({ name: " ", description: "x".repeat(501) }).expect(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists only owned projects with aggregate endpoint health", async () => {
    const project = await prisma.project.create({ data: { userId: user.id, name: "Owned" } });
    await prisma.monitor.createMany({
      data: [
        { userId: user.id, projectId: project.id, name: "Healthy", url: "https://up.example.com", isUp: true },
        { userId: user.id, projectId: project.id, name: "Failed", url: "https://down.example.com", isUp: false },
        { userId: user.id, projectId: project.id, name: "Paused", url: "https://paused.example.com", status: "PAUSED" },
      ],
    });
    const other = await prisma.user.create({
      data: { name: "Other", email: "other-project@example.com", passwordHash: "unused" },
    });
    await prisma.project.create({ data: { userId: other.id, name: "Private" } });

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      name: "Owned",
      health: "DOWN",
      endpointCounts: { total: 3, active: 2, paused: 1, up: 1, down: 1, unknown: 1 },
    });
  });

  it("supports project search, pagination, retrieval, and updates", async () => {
    const first = (await createProject({ name: "Billing API", description: "Payments" }).expect(201)).body.data;
    await createProject({ name: "Identity API" }).expect(201);

    const list = await request(app)
      .get("/api/v1/projects?search=billing&page=1&limit=1")
      .set("Authorization", authorization)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });

    const updated = await request(app)
      .patch(`/api/v1/projects/${first.id}`)
      .set("Authorization", authorization)
      .send({ name: "Payments API", description: "Billing endpoints" })
      .expect(200);
    expect(updated.body.data).toMatchObject({ name: "Payments API", description: "Billing endpoints" });
  });

  it("does not reveal or mutate another user's project", async () => {
    const other = await prisma.user.create({
      data: { name: "Other", email: "hidden-project@example.com", passwordHash: "unused" },
    });
    const project = await prisma.project.create({ data: { userId: other.id, name: "Hidden" } });
    await request(app).get(`/api/v1/projects/${project.id}`).set("Authorization", authorization).expect(404);
    await request(app).patch(`/api/v1/projects/${project.id}`).set("Authorization", authorization).send({ name: "Stolen" }).expect(404);
    await request(app).delete(`/api/v1/projects/${project.id}`).set("Authorization", authorization).expect(404);
  });

  it("creates multiple endpoints in one project and filters them by project", async () => {
    const project = (await createProject().expect(201)).body.data;
    const endpoint = {
      projectId: project.id,
      name: "Health endpoint",
      url: "https://example.com/health",
      expectedStatusCode: 200,
      timeoutMs: 5000,
      intervalSeconds: 300,
    };
    await request(app).post("/api/v1/endpoints").set("Authorization", authorization).send(endpoint).expect(201);
    await request(app).post("/api/v1/endpoints").set("Authorization", authorization).send({ ...endpoint, name: "Users endpoint", url: "https://example.com/users" }).expect(201);

    const response = await request(app)
      .get(`/api/v1/endpoints?projectId=${project.id}`)
      .set("Authorization", authorization)
      .expect(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.every((item) => item.projectId === project.id)).toBe(true);
    expect(response.body.data[0].project.name).toBe("Commerce API");
  });

  it("rejects creating or moving an endpoint into another user's project", async () => {
    const project = (await createProject().expect(201)).body.data;
    const other = await prisma.user.create({
      data: { name: "Other", email: "foreign-project@example.com", passwordHash: "unused" },
    });
    const foreign = await prisma.project.create({ data: { userId: other.id, name: "Foreign" } });
    const payload = { projectId: foreign.id, name: "Endpoint", url: "https://example.com" };
    const rejected = await request(app).post("/api/v1/endpoints").set("Authorization", authorization).send(payload).expect(404);
    expect(rejected.body.error.code).toBe("PROJECT_NOT_FOUND");

    const endpoint = await prisma.monitor.create({
      data: { userId: user.id, projectId: project.id, name: "Owned", url: "https://owned.example.com" },
    });
    await request(app)
      .patch(`/api/v1/endpoints/${endpoint.id}`)
      .set("Authorization", authorization)
      .send({ projectId: foreign.id })
      .expect(404);
  });

  it("deleting a project cascades through endpoints and check history", async () => {
    const project = await prisma.project.create({ data: { userId: user.id, name: "Disposable" } });
    const endpoint = await prisma.monitor.create({
      data: { userId: user.id, projectId: project.id, name: "Endpoint", url: "https://example.com" },
    });
    await prisma.checkResult.create({
      data: { monitorId: endpoint.id, checkedAt: new Date(), success: true, statusCode: 200, responseTimeMs: 10 },
    });

    await request(app).delete(`/api/v1/projects/${project.id}`).set("Authorization", authorization).expect(204);
    expect(await prisma.monitor.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.checkResult.count({ where: { monitorId: endpoint.id } })).toBe(0);
  });

  it("keeps the legacy monitor API by assigning an Imported endpoints project", async () => {
    const response = await request(app)
      .post("/api/v1/monitors")
      .set("Authorization", authorization)
      .send({ name: "Legacy endpoint", url: "https://legacy.example.com" })
      .expect(201);
    expect(response.body.data.project.name).toBe("Imported endpoints");
  });
});
