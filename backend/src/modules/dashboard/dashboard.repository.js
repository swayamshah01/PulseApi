export function createDashboardRepository(database) {
  return {
    getMonitors(userId) {
      return database.monitor.findMany({
        where: { userId },
        select: { id: true, status: true, isUp: true },
      });
    },

    getCheckGroups(userId) {
      return database.checkResult.groupBy({
        by: ["monitorId", "success"],
        where: { monitor: { userId } },
        _count: { _all: true },
      });
    },

    getRecentFailures(userId, limit = 5) {
      return database.checkResult.findMany({
        where: { success: false, monitor: { userId } },
        orderBy: { checkedAt: "desc" },
        take: limit,
        include: { monitor: { select: { name: true } } },
      });
    },
  };
}
