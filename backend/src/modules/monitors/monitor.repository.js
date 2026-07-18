export function createMonitorRepository(database) {
  function findOwned(userId, monitorId) {
    return database.monitor.findFirst({
      where: { id: monitorId, userId },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  function buildWhere(userId, filters = {}) {
    const where = { userId };

    if (filters.projectId) where.projectId = filters.projectId;
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
      return database.monitor.create({
        data: { ...data, userId },
        include: { project: { select: { id: true, name: true } } },
      });
    },

    findOwnedProject(userId, projectId) {
      return database.project.findFirst({ where: { id: projectId, userId } });
    },

    getOrCreateImportedProject(userId) {
      return database.project.upsert({
        where: { userId_name: { userId, name: "Imported endpoints" } },
        update: {},
        create: {
          userId,
          name: "Imported endpoints",
          description: "Endpoints created through the legacy monitor API.",
        },
      });
    },

    async list(userId, query) {
      const where = buildWhere(userId, query);
      const [monitors, total] = await Promise.all([
        database.monitor.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { [query.sortBy]: query.sortOrder },
          include: { project: { select: { id: true, name: true } } },
        }),
        database.monitor.count({ where }),
      ]);

      return { monitors, total };
    },

    findOwned,

    async updateOwned(userId, monitorId, data) {
      const result = await database.monitor.updateMany({
        where: { id: monitorId, userId },
        data,
      });

      if (result.count !== 1) return null;
      return findOwned(userId, monitorId);
    },

    deleteOwned(userId, monitorId) {
      return database.monitor.deleteMany({
        where: { id: monitorId, userId },
      });
    },
  };
}
