import { AppError } from "../../common/errors/AppError.js";
import { mapMonitor } from "./monitor.mapper.js";
import { createMonitorRepository } from "./monitor.repository.js";

const MONITOR_NOT_FOUND_MESSAGE = "The requested monitor does not exist.";

function notFoundError() {
  return new AppError(404, "MONITOR_NOT_FOUND", MONITOR_NOT_FOUND_MESSAGE);
}

export function createMonitorService({ database, config }) {
  const repository = createMonitorRepository(database);

  return {
    async create(userId, input) {
      const count = await repository.countForUser(userId);

      if (count >= config.MAX_MONITORS_PER_USER) {
        throw new AppError(
          409,
          "MONITOR_LIMIT_REACHED",
          `A maximum of ${config.MAX_MONITORS_PER_USER} monitors is allowed per user.`,
        );
      }

      const requestedProjectId = input.projectId;
      const project = requestedProjectId
        ? await repository.findOwnedProject(userId, requestedProjectId)
        : await repository.getOrCreateImportedProject(userId);
      if (!project) {
        throw new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
      }

      const { projectId: _projectId, ...endpointInput } = input;

      const monitor = await repository.create(userId, {
        ...endpointInput,
        projectId: project.id,
        method: "GET",
        status: "ACTIVE",
        isUp: null,
        consecutiveFailures: 0,
        nextCheckAt: new Date(),
      });

      return mapMonitor(monitor);
    },

    async list(userId, query) {
      const { monitors, total } = await repository.list(userId, query);

      return {
        monitors: monitors.map(mapMonitor),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async get(userId, monitorId) {
      const monitor = await repository.findOwned(userId, monitorId);
      if (!monitor) throw notFoundError();
      return mapMonitor(monitor);
    },

    async update(userId, monitorId, input) {
      const current = await repository.findOwned(userId, monitorId);
      if (!current) throw notFoundError();

      if (input.projectId !== undefined) {
        const project = await repository.findOwnedProject(userId, input.projectId);
        if (!project) {
          throw new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
        }
      }

      const changes = { ...input };
      const schedulingChanged =
        (input.url !== undefined && input.url !== current.url) ||
        (input.intervalSeconds !== undefined &&
          input.intervalSeconds !== current.intervalSeconds);

      if (schedulingChanged) changes.nextCheckAt = new Date();

      const monitor = await repository.updateOwned(userId, monitorId, changes);
      if (!monitor) throw notFoundError();
      return mapMonitor(monitor);
    },

    async delete(userId, monitorId) {
      const result = await repository.deleteOwned(userId, monitorId);
      if (result.count !== 1) throw notFoundError();
    },

    async pause(userId, monitorId) {
      const monitor = await repository.updateOwned(userId, monitorId, {
        status: "PAUSED",
        nextCheckAt: null,
      });
      if (!monitor) throw notFoundError();
      return mapMonitor(monitor);
    },

    async resume(userId, monitorId) {
      const monitor = await repository.updateOwned(userId, monitorId, {
        status: "ACTIVE",
        nextCheckAt: new Date(),
      });
      if (!monitor) throw notFoundError();
      return mapMonitor(monitor);
    },
  };
}
