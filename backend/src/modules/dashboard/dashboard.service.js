import { createDashboardRepository } from "./dashboard.repository.js";

export function createDashboardService(database) {
  const repository = createDashboardRepository(database);

  return {
    async getSummary(userId) {
      const [monitors, groups, recentFailures] = await Promise.all([
        repository.getMonitors(userId),
        repository.getCheckGroups(userId),
        repository.getRecentFailures(userId),
      ]);
      const perMonitor = new Map();

      for (const group of groups) {
        const current = perMonitor.get(group.monitorId) ?? { total: 0, successful: 0 };
        current.total += group._count._all;
        current.successful += group.success ? group._count._all : 0;
        perMonitor.set(group.monitorId, current);
      }

      const uptimeValues = [...perMonitor.values()].map(
        ({ successful, total }) => (successful / total) * 100,
      );

      return {
        counts: {
          total: monitors.length,
          active: monitors.filter((monitor) => monitor.status === "ACTIVE").length,
          paused: monitors.filter((monitor) => monitor.status === "PAUSED").length,
          up: monitors.filter((monitor) => monitor.isUp === true).length,
          down: monitors.filter((monitor) => monitor.isUp === false).length,
          unknown: monitors.filter((monitor) => monitor.isUp === null).length,
        },
        averageUptimePercentage: uptimeValues.length
          ? Number((uptimeValues.reduce((sum, value) => sum + value, 0) / uptimeValues.length).toFixed(2))
          : null,
        recentFailures: recentFailures.map((result) => ({
          id: result.id.toString(),
          monitorId: result.monitorId,
          monitorName: result.monitor.name,
          checkedAt: result.checkedAt,
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          errorType: result.errorType,
          errorMessage: result.errorMessage,
        })),
      };
    },
  };
}
