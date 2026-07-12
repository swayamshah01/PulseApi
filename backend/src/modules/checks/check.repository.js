export function createCheckRepository(database) {
  return {
    findOwnedMonitor(userId, monitorId) {
      return database.monitor.findFirst({ where: { id: monitorId, userId } });
    },

    async listResults(monitorId, query) {
      const checkedAt = {};
      if (query.from) checkedAt.gte = query.from;
      if (query.to) checkedAt.lte = query.to;
      const where = {
        monitorId,
        ...(Object.keys(checkedAt).length ? { checkedAt } : {}),
        ...(query.result === "successful" ? { success: true } : {}),
        ...(query.result === "failed" ? { success: false } : {}),
      };
      const [results, total] = await Promise.all([
        database.checkResult.findMany({
          where,
          orderBy: { checkedAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        database.checkResult.count({ where }),
      ]);

      return { results, total };
    },

    findResultsForStats(monitorId, from) {
      return database.checkResult.findMany({
        where: {
          monitorId,
          ...(from ? { checkedAt: { gte: from } } : {}),
        },
        orderBy: { checkedAt: "asc" },
        select: {
          checkedAt: true,
          success: true,
          responseTimeMs: true,
        },
      });
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
