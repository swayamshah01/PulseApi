import { AppError } from "../../common/errors/AppError.js";
import { mapProject } from "./project.mapper.js";
import { createProjectRepository } from "./project.repository.js";

function notFoundError() {
  return new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
}

function duplicateError() {
  return new AppError(409, "PROJECT_ALREADY_EXISTS", "A project with this name already exists.");
}

export function createProjectService(database) {
  const repository = createProjectRepository(database);

  return {
    async create(userId, input) {
      try {
        return mapProject(await repository.create(userId, input));
      } catch (error) {
        if (error.code === "P2002") throw duplicateError();
        throw error;
      }
    },

    async list(userId, query) {
      const { projects, total } = await repository.list(userId, query);
      return {
        projects: projects.map(mapProject),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async get(userId, projectId) {
      const project = await repository.findOwned(userId, projectId);
      if (!project) throw notFoundError();
      return mapProject(project);
    },

    async update(userId, projectId, input) {
      try {
        const project = await repository.updateOwned(userId, projectId, input);
        if (!project) throw notFoundError();
        return mapProject(project);
      } catch (error) {
        if (error.code === "P2002") throw duplicateError();
        throw error;
      }
    },

    async delete(userId, projectId) {
      const result = await repository.deleteOwned(userId, projectId);
      if (result.count !== 1) throw notFoundError();
    },
  };
}
