import { Router } from "express";

import type { ChangelogController } from "./changelog-controller";

export function createChangelogRouter(controller: ChangelogController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.get("/latest", controller.latest);
  router.get("/unread-count", controller.unreadCount);
  router.post("/read", controller.markRead);

  return router;
}

export function createAdminChangelogRouter(
  controller: ChangelogController,
): Router {
  const router = Router();

  router.post("/releases", controller.createRelease);
  router.patch("/releases/:id", controller.updateRelease);
  router.delete("/releases/:id", controller.deleteRelease);
  router.post("/releases/:id/entries", controller.createEntry);
  router.patch("/changelog-entries/:id", controller.updateEntry);
  router.delete("/changelog-entries/:id", controller.deleteEntry);
  router.post("/releases/:id/publish", controller.publishRelease);

  return router;
}
