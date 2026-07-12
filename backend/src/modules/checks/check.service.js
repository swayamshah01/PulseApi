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

    async getHistory(userId, monitorId, query) {
      const monitor = await repository.findOwnedMonitor(userId, monitorId);
      if (!monitor) {
        throw new AppError(404, "MONITOR_NOT_FOUND", "The requested monitor does not exist.");
      }

      const { results, total } = await repository.listResults(monitorId, query);
      return {
        results: results.map(mapCheckResult),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async getStats(userId, monitorId, range) {
      const monitor = await repository.findOwnedMonitor(userId, monitorId);
      if (!monitor) {
        throw new AppError(404, "MONITOR_NOT_FOUND", "The requested monitor does not exist.");
      }

      const rangeMs = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      }[range];
      const from = rangeMs ? new Date(Date.now() - rangeMs) : null;
      const results = await repository.findResultsForStats(monitorId, from);
      const successfulChecks = results.filter((result) => result.success).length;
      const totalChecks = results.length;
      const responseTimes = results.map((result) => result.responseTimeMs);
      const bucketMs = range === "1h" ? 5 * 60 * 1000 : range === "30d" || range === "all" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
      const buckets = new Map();

      for (const result of results) {
        const timestamp = Math.floor(result.checkedAt.getTime() / bucketMs) * bucketMs;
        const bucket = buckets.get(timestamp) ?? { total: 0, successful: 0, responseTotal: 0 };
        bucket.total += 1;
        bucket.successful += result.success ? 1 : 0;
        bucket.responseTotal += result.responseTimeMs;
        buckets.set(timestamp, bucket);
      }

      return {
        range,
        totalChecks,
        successfulChecks,
        failedChecks: totalChecks - successfulChecks,
        uptimePercentage: totalChecks ? Number(((successfulChecks / totalChecks) * 100).toFixed(2)) : null,
        averageResponseTimeMs: totalChecks ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / totalChecks) : null,
        minimumResponseTimeMs: totalChecks ? Math.min(...responseTimes) : null,
        maximumResponseTimeMs: totalChecks ? Math.max(...responseTimes) : null,
        currentStatus: monitor.isUp === null ? "UNKNOWN" : monitor.isUp ? "UP" : "DOWN",
        series: [...buckets.entries()].map(([timestamp, bucket]) => ({
          timestamp: new Date(timestamp),
          averageResponseTimeMs: Math.round(bucket.responseTotal / bucket.total),
          successRate: Number(((bucket.successful / bucket.total) * 100).toFixed(2)),
        })),
      };
    },
  };
}
