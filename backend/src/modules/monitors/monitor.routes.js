import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { createMonitorController } from "./monitor.controller.js";
import { createMonitorService } from "./monitor.service.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
  validateMonitorBody,
  validateMonitorListQuery,
} from "./monitor.schema.js";

export function createMonitorRouter({ database, config }) {
  const router = Router();
  const service = createMonitorService({ database, config });
  const controller = createMonitorController(service);

  router.use(authenticate(config));
  router.post("/", validateMonitorBody(createMonitorSchema), controller.create);
  router.get("/", validateMonitorListQuery, controller.list);
  router.get("/:monitorId", controller.get);
  router.patch(
    "/:monitorId",
    validateMonitorBody(updateMonitorSchema),
    controller.update,
  );
  router.delete("/:monitorId", controller.delete);
  router.post("/:monitorId/pause", controller.pause);
  router.post("/:monitorId/resume", controller.resume);

  return router;
}
