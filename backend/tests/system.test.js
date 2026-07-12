import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeApp(queryError) {
  const database = {
    $queryRaw: vi.fn(async () => {
      if (queryError) {
        throw queryError;
      }

      return [{ "?column?": 1 }];
    }),
  };

  return { app: createApp({ database, logger: silentLogger }), database };
}

describe("system endpoints", () => {
  it("GET /health returns the standard liveness response without querying the database", async () => {
    const { app, database } = makeApp();
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok",
        service: "pulseapi-backend",
        timestamp: expect.any(String),
      },
    });
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
    expect(database.$queryRaw).not.toHaveBeenCalled();
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("GET /ready returns 200 when PostgreSQL responds", async () => {
    const { app, database } = makeApp();
    const response = await request(app).get("/ready").expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ready",
        database: "connected",
      },
    });
    expect(database.$queryRaw).toHaveBeenCalledOnce();
  });

  it("GET /ready returns the standard 503 error when PostgreSQL is unavailable", async () => {
    const { app } = makeApp(new Error("database unavailable"));
    const response = await request(app).get("/ready").expect(503);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "The service is not ready to accept traffic.",
        details: [],
      },
    });
  });

  it("unknown routes use the standard error response", async () => {
    const { app } = makeApp();
    const response = await request(app).get("/missing").expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route GET /missing was not found.",
        details: [],
      },
    });
  });
});
