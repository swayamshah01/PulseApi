export function createCheckRepository(database) {
  return {
    findOwnedMonitor(userId, monitorId) {
      return database.monitor.findFirst({ where: { id: monitorId, userId } });
    },

    async saveResultAndSummary(monitor, result) {
      const nextCheckAt =
        monitor.status === "ACTIVE"
          ? new Date(result.checkedAt.getTime() + monitor.intervalSeconds * 1000)
          : null;

      return database.$transaction(async (transaction) => {
        const savedResult = await transaction.checkResult.create({
          data: {
            monitorId: monitor.id,
            checkedAt: result.checkedAt,
            success: result.success,
            statusCode: result.statusCode,
            responseTimeMs: result.responseTimeMs,
            errorType: result.errorType,
            errorMessage: result.errorMessage,
            responseSizeBytes: result.responseSizeBytes,
          },
        });

        await transaction.monitor.update({
          where: { id: monitor.id },
          data: {
            isUp: result.success,
            lastStatusCode: result.statusCode,
            lastResponseTimeMs: result.responseTimeMs,
            lastCheckedAt: result.checkedAt,
            nextCheckAt,
            consecutiveFailures: result.success ? 0 : { increment: 1 },
          },
        });

        return savedResult;
      });
    },
  };
}
