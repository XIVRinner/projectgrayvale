import { Router } from "express";
import { TagRegistryService } from "./tag-registry-service";

export function createTagRegistryRouter(service: TagRegistryService): Router {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      const registry = await service.getRegistry();
      response.setHeader("Cache-Control", "no-cache").json(registry);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
