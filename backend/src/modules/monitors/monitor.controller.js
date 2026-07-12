import { sendSuccess } from "../../common/utils/responses.js";

export function createMonitorController(service, checkService) {
  return {
    async create(request, response, next) {
      try {
        const monitor = await service.create(request.user.id, request.validatedBody);
        return sendSuccess(response, monitor, { statusCode: 201 });
      } catch (error) {
        return next(error);
      }
    },

    async list(request, response, next) {
      try {
        const result = await service.list(request.user.id, request.validatedQuery);
        return sendSuccess(response, result.monitors, { meta: result.meta });
      } catch (error) {
        return next(error);
      }
    },

    async get(request, response, next) {
      try {
        const monitor = await service.get(request.user.id, request.params.monitorId);
        return sendSuccess(response, monitor);
      } catch (error) {
        return next(error);
      }
    },

    async update(request, response, next) {
      try {
        const monitor = await service.update(
          request.user.id,
          request.params.monitorId,
          request.validatedBody,
        );
        return sendSuccess(response, monitor);
      } catch (error) {
        return next(error);
      }
    },

    async delete(request, response, next) {
      try {
        await service.delete(request.user.id, request.params.monitorId);
        return response.status(204).send();
      } catch (error) {
        return next(error);
      }
    },

    async pause(request, response, next) {
      try {
        const monitor = await service.pause(request.user.id, request.params.monitorId);
        return sendSuccess(response, monitor);
      } catch (error) {
        return next(error);
      }
    },

    async resume(request, response, next) {
      try {
        const monitor = await service.resume(request.user.id, request.params.monitorId);
        return sendSuccess(response, monitor);
      } catch (error) {
        return next(error);
      }
    },

    async check(request, response, next) {
      try {
        const result = await checkService.runManualCheck(
          request.user.id,
          request.params.monitorId,
        );
        return sendSuccess(response, result);
      } catch (error) {
        return next(error);
      }
    },
  };
}
