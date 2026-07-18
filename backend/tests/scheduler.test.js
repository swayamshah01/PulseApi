import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { createMonitorScheduler } from "../src/scheduler/monitor.scheduler.js";
import { createCheckService } from "../src/modules/checks/check.service.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let user;
let project;

function config(overrides = {}) {
  return {
    SCHEDULER_ENABLED: true,
    SCHEDULER_CRON: "* * * * *",
    SCHEDULER_BATCH_SIZE: 25,
    SCHEDULER_CONCURRENCY: 5,
    ...overrides,
  };
}

async function seedMonitor(overrides = {}) {
  return prisma.monitor.create({
    data: {
      userId: user.id,
      projectId: project.id,
      name: `Scheduled ${Math.random()}`,
      url: "https://scheduled.example.com/",
      status: "ACTIVE",
      nextCheckAt: new Date(Date.now() - 60_000),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await prisma.checkResult.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
  user = await prisma.user.create({
    data: { name: "Scheduler Owner", email: "scheduler@example.com", passwordHash: "unused" },
  });
  project = await prisma.project.create({ data: { userId: user.id, name: "Scheduler project" } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("monitor scheduler", () => {
  it("selects only active monitors that are due", async () => {
    const due = await seedMonitor({ name: "Due" });
    await seedMonitor({ name: "Future", nextCheckAt: new Date(Date.now() + 60_000) });
    await seedMonitor({ name: "Paused", status: "PAUSED", nextCheckAt: null });
    const checked = [];
    const checkService = {
      isRunning: () => false,
      runScheduledCheck: async (monitor) => checked.push(monitor.id),
    };
    const scheduler = createMonitorScheduler({ database: prisma, checkService, logger, config: config() });

    const result = await scheduler.runCycle();
    expect(checked).toEqual([due.id]);
    expect(result).toMatchObject({ selected: 1, completed: 1, failed: 0 });
  });

  it("limits each cycle to the configured batch size", async () => {
    await Promise.all(Array.from({ length: 5 }, () => seedMonitor()));
    const checked = [];
    const checkService = {
      isRunning: () => false,
      runScheduledCheck: async (monitor) => checked.push(monitor.id),
    };
    const scheduler = createMonitorScheduler({
      database: prisma,
      checkService,
      logger,
      config: config({ SCHEDULER_BATCH_SIZE: 2 }),
    });

    await scheduler.runCycle();
    expect(checked).toHaveLength(2);
  });

  it("limits concurrent outbound checks", async () => {
    await Promise.all(Array.from({ length: 6 }, () => seedMonitor()));
    let active = 0;
    let maximumActive = 0;
    const checkService = {
      isRunning: () => false,
      runScheduledCheck: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
      },
    };
    const scheduler = createMonitorScheduler({
      database: prisma,
      checkService,
      logger,
      config: config({ SCHEDULER_CONCURRENCY: 2 }),
    });

    await scheduler.runCycle();
    expect(maximumActive).toBe(2);
  });

  it("skips monitors already being checked", async () => {
    const skipped = await seedMonitor({ name: "Already Running" });
    const runnable = await seedMonitor({ name: "Runnable" });
    const checked = [];
    const checkService = {
      isRunning: (id) => id === skipped.id,
      runScheduledCheck: async (monitor) => checked.push(monitor.id),
    };
    const scheduler = createMonitorScheduler({ database: prisma, checkService, logger, config: config() });

    await scheduler.runCycle();
    expect(checked).toEqual([runnable.id]);
  });

  it("prevents overlapping cycles", async () => {
    await seedMonitor();
    let release;
    const checkService = {
      isRunning: () => false,
      runScheduledCheck: () => new Promise((resolve) => {
        release = resolve;
      }),
    };
    const scheduler = createMonitorScheduler({ database: prisma, checkService, logger, config: config() });
    const first = scheduler.runCycle();
    while (!release) await new Promise((resolve) => setImmediate(resolve));

    const overlapping = await scheduler.runCycle();
    expect(overlapping.skipped).toBe(true);
    release();
    await first;
  });

  it("continues a batch after one monitor fails", async () => {
    await Promise.all([seedMonitor(), seedMonitor(), seedMonitor()]);
    let attempts = 0;
    const checkService = {
      isRunning: () => false,
      runScheduledCheck: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("one failure");
      },
    };
    const scheduler = createMonitorScheduler({ database: prisma, checkService, logger, config: config() });

    const result = await scheduler.runCycle();
    expect(attempts).toBe(3);
    expect(result).toMatchObject({ completed: 2, failed: 1 });
  });

  it("runs overdue checks immediately on startup", async () => {
    await seedMonitor();
    const checkService = {
      isRunning: () => false,
      runScheduledCheck: vi.fn(async () => {}),
    };
    const task = { stop: vi.fn(), destroy: vi.fn() };
    const cronLibrary = { schedule: vi.fn(() => task) };
    const scheduler = createMonitorScheduler({
      database: prisma,
      checkService,
      logger,
      config: config(),
      cronLibrary,
    });

    await scheduler.start();
    expect(checkService.runScheduledCheck).toHaveBeenCalledOnce();
    expect(cronLibrary.schedule).toHaveBeenCalledWith(
      "* * * * *",
      expect.any(Function),
      expect.objectContaining({ noOverlap: true }),
    );
    scheduler.stop();
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("persists an automatic result and advances nextCheckAt", async () => {
    const monitor = await seedMonitor({ intervalSeconds: 600 });
    const checkService = createCheckService({
      database: prisma,
      logger,
      httpClient: async () => ({ statusCode: 200, responseSizeBytes: 4 }),
    });
    const scheduler = createMonitorScheduler({ database: prisma, checkService, logger, config: config() });

    await scheduler.runCycle();
    const updated = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });
    expect(await prisma.checkResult.count({ where: { monitorId: monitor.id } })).toBe(1);
    expect(updated.isUp).toBe(true);
    expect(updated.nextCheckAt.getTime()).toBeGreaterThan(Date.now() + 500_000);
  });

  it("does not schedule work when disabled", async () => {
    const cronLibrary = { schedule: vi.fn() };
    const scheduler = createMonitorScheduler({
      database: prisma,
      checkService: { isRunning: () => false, runScheduledCheck: vi.fn() },
      logger,
      config: config({ SCHEDULER_ENABLED: false }),
      cronLibrary,
    });

    await expect(scheduler.start()).resolves.toEqual({ disabled: true });
    expect(cronLibrary.schedule).not.toHaveBeenCalled();
  });
});
