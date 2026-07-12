import cron from "node-cron";
import { createSchedulerRepository } from "./scheduler.repository.js";

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );
}

export function createMonitorScheduler({
  database,
  checkService,
  logger,
  config,
  cronLibrary = cron,
}) {
  const repository = createSchedulerRepository(database);
  let task = null;
  let cycleRunning = false;

  async function runCycle() {
    if (cycleRunning) {
      logger.warn("scheduler cycle skipped because the previous cycle is still running");
      return { selected: 0, completed: 0, failed: 0, skipped: true };
    }

    cycleRunning = true;
    let completed = 0;
    let failed = 0;

    try {
      const monitors = await repository.findDueMonitors(
        new Date(),
        config.SCHEDULER_BATCH_SIZE,
      );
      const runnable = monitors.filter((monitor) => !checkService.isRunning(monitor.id));

      await runWithConcurrency(
        runnable,
        config.SCHEDULER_CONCURRENCY,
        async (monitor) => {
          try {
            await checkService.runScheduledCheck(monitor);
            completed += 1;
          } catch (error) {
            failed += 1;
            logger.error(
              { monitorId: monitor.id, error: { name: error.name, message: error.message } },
              "scheduled monitor check failed",
            );
          }
        },
      );

      logger.info(
        { selected: monitors.length, runnable: runnable.length, completed, failed },
        "scheduler cycle completed",
      );
      return { selected: monitors.length, completed, failed, skipped: false };
    } finally {
      cycleRunning = false;
    }
  }

  function start() {
    if (!config.SCHEDULER_ENABLED) {
      logger.info("monitor scheduler is disabled");
      return Promise.resolve({ disabled: true });
    }

    task = cronLibrary.schedule(
      config.SCHEDULER_CRON,
      () => runCycle().catch((error) => logger.error({ error }, "scheduler cycle crashed")),
      { name: "pulseapi-monitor-scheduler", noOverlap: true },
    );
    logger.info({ cron: config.SCHEDULER_CRON }, "monitor scheduler started");

    return runCycle();
  }

  function stop() {
    task?.stop();
    task?.destroy();
    task = null;
  }

  return { start, stop, runCycle };
}
