import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { createDashboardController } from "./dashboard.controller.js";
import { createDashboardService } from "./dashboard.service.js";

export function createDashboardRouter({ database, config }) {
  const router = Router();
  const controller = createDashboardController(createDashboardService(database));

  router.use(authenticate(config));
  router.get("/summary", controller.summary);
  return router;
}
