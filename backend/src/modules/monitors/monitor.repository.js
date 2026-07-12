export function createMonitorRepository(database) {
  function buildWhere(userId, filters = {}) {
    const where = { userId };

    if (filters.status) where.status = filters.status;
    if (filters.health === "up") where.isUp = true;
    if (filters.health === "down") where.isUp = false;
    if (filters.health === "unknown") where.isUp = null;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { url: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  return {
    countForUser(userId) {
      return database.monitor.count({ where: { userId } });
    },

    create(userId, data) {
      return database.monitor.create({ data: { ...data, userId } });
    },

    async list(userId, query) {
      const where = buildWhere(userId, query);
      const [monitors, total] = await Promise.all([
        database.monitor.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { [query.sortBy]: query.sortOrder },
        }),
        database.monitor.count({ where }),
      ]);

      return { monitors, total };
    },

    findOwned(userId, monitorId) {
      return database.monitor.findFirst({
        where: { id: monitorId, userId },
      });
    },

    async updateOwned(userId, monitorId, data) {
      const result = await database.monitor.updateMany({
        where: { id: monitorId, userId },
        data,
      });

      if (result.count !== 1) return null;
      return this.findOwned(userId, monitorId);
    },

    deleteOwned(userId, monitorId) {
      return database.monitor.deleteMany({
        where: { id: monitorId, userId },
      });
    },
  };
}
