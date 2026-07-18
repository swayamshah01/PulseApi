import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { createProjectController } from "./project.controller.js";
import { createProjectService } from "./project.service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  validateProjectBody,
  validateProjectListQuery,
} from "./project.schema.js";

export function createProjectRouter({ database, config }) {
  const router = Router();
  const controller = createProjectController(createProjectService(database));

  router.use(authenticate(config));
  router.post("/", validateProjectBody(createProjectSchema), controller.create);
  router.get("/", validateProjectListQuery, controller.list);
  router.get("/:projectId", controller.get);
  router.patch("/:projectId", validateProjectBody(updateProjectSchema), controller.update);
  router.delete("/:projectId", controller.delete);

  return router;
}
