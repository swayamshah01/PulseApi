import { sendSuccess } from "../../common/utils/responses.js";

export function createProjectController(service) {
  return {
    async create(request, response, next) {
      try {
        return sendSuccess(response, await service.create(request.user.id, request.validatedBody), { statusCode: 201 });
      } catch (error) {
        return next(error);
      }
    },
    async list(request, response, next) {
      try {
        const result = await service.list(request.user.id, request.validatedQuery);
        return sendSuccess(response, result.projects, { meta: result.meta });
      } catch (error) {
        return next(error);
      }
    },
    async get(request, response, next) {
      try {
        return sendSuccess(response, await service.get(request.user.id, request.params.projectId));
      } catch (error) {
        return next(error);
      }
    },
    async update(request, response, next) {
      try {
        return sendSuccess(response, await service.update(request.user.id, request.params.projectId, request.validatedBody));
      } catch (error) {
        return next(error);
      }
    },
    async delete(request, response, next) {
      try {
        await service.delete(request.user.id, request.params.projectId);
        return response.status(204).send();
      } catch (error) {
        return next(error);
      }
    },
  };
}
