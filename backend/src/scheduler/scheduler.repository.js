export function createSchedulerRepository(database) {
  return {
    findDueMonitors(now, limit) {
      return database.monitor.findMany({
        where: {
          status: "ACTIVE",
          nextCheckAt: { lte: now },
        },
        orderBy: { nextCheckAt: "asc" },
        take: limit,
      });
    },
  };
}
