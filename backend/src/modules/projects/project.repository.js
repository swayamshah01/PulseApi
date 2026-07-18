export function createProjectRepository(database) {
  const endpointSummary = {
    status: true,
    isUp: true,
    lastCheckedAt: true,
  };

  function findOwned(userId, projectId) {
    return database.project.findFirst({
      where: { id: projectId, userId },
      include: { monitors: { select: endpointSummary } },
    });
  }

  return {
    create(userId, data) {
      return database.project.create({
        data: { ...data, userId },
        include: { monitors: { select: endpointSummary } },
      });
    },

    async list(userId, query) {
      const where = {
        userId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [projects, total] = await Promise.all([
        database.project.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { [query.sortBy]: query.sortOrder },
          include: { monitors: { select: endpointSummary } },
        }),
        database.project.count({ where }),
      ]);
      return { projects, total };
    },

    findOwned,

    async updateOwned(userId, projectId, data) {
      const result = await database.project.updateMany({
        where: { id: projectId, userId },
        data,
      });
      if (result.count !== 1) return null;
      return findOwned(userId, projectId);
    },

    deleteOwned(userId, projectId) {
      return database.project.deleteMany({ where: { id: projectId, userId } });
    },
  };
}
