import { sendSuccess } from "../../common/utils/responses.js";

export function createDashboardController(service) {
  return {
    async summary(request, response, next) {
      try {
        return sendSuccess(response, await service.getSummary(request.user.id));
      } catch (error) {
        return next(error);
      }
    },
  };
}
