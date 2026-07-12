import { performance } from "node:perf_hooks";
import { AppError } from "../../common/errors/AppError.js";
import { secureGet } from "../../security/secure-http-client.js";
import { mapCheckResult } from "./check.mapper.js";
import { createCheckRepository } from "./check.repository.js";
import { classifyCheckError } from "./check.types.js";

export function createCheckService({ database, logger, httpClient = secureGet }) {
  const repository = createCheckRepository(database);
  const runningMonitorIds = new Set();

  async function execute(monitor, source) {
    if (runningMonitorIds.has(monitor.id)) {
      throw new AppError(409, "CHECK_ALREADY_RUNNING", "A check is already running for this monitor.");
    }

    runningMonitorIds.add(monitor.id);
    const startedAt = performance.now();
    let outcome;

    try {
      try {
        const response = await httpClient(monitor.url, {
          timeoutMs: monitor.timeoutMs,
        });
        const success = response.statusCode === monitor.expectedStatusCode;
        outcome = {
          success,
          statusCode: response.statusCode,
          errorType: success ? null : "INVALID_STATUS",
          errorMessage: success
            ? null
            : `Expected status ${monitor.expectedStatusCode} but received ${response.statusCode}.`,
          responseSizeBytes: response.responseSizeBytes,
        };
      } catch (error) {
        outcome = {
          success: false,
          statusCode: null,
          ...classifyCheckError(error),
          responseSizeBytes: null,
        };
      }

      const result = {
        ...outcome,
        responseTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
        checkedAt: new Date(),
      };
      const saved = await repository.saveResultAndSummary(monitor, result);

      logger.info(
        {
          monitorId: monitor.id,
          source,
          durationMs: result.responseTimeMs,
          success: result.success,
          errorType: result.errorType,
          statusCode: result.statusCode,
        },
        "monitor check completed",
      );

      return mapCheckResult(saved);
    } finally {
      runningMonitorIds.delete(monitor.id);
    }
  }

  return {
    async runManualCheck(userId, monitorId) {
      const monitor = await repository.findOwnedMonitor(userId, monitorId);

      if (!monitor) {
        throw new AppError(404, "MONITOR_NOT_FOUND", "The requested monitor does not exist.");
      }

      return execute(monitor, "manual");
    },

    runScheduledCheck(monitor) {
      return execute(monitor, "scheduled");
    },

    isRunning(monitorId) {
      return runningMonitorIds.has(monitorId);
    },
  };
}
