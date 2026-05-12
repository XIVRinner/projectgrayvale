import { readFile } from "node:fs/promises";

import { Router } from "express";
import { type TagRegistry, tagRegistrySchema } from "./tag-registry-schema";

export function createTagRegistryRouter(tagRegistryPath: string): Router {
  const router = Router();
  let registryPromise: Promise<TagRegistry> | null = null;

  router.get("/", async (_request, response, next) => {
    try {
      const registry = await getRegistry();
      response.setHeader("Cache-Control", "no-cache").json(registry);
    } catch (error) {
      next(error);
    }
  });

  return router;

  function getRegistry(): Promise<TagRegistry> {
    if (!registryPromise) {
      registryPromise = readRegistryFile(tagRegistryPath);
    }

    return registryPromise;
  }
}

async function readRegistryFile(
  tagRegistryPath: string,
): Promise<TagRegistry> {
  const rawRegistry = await readFile(tagRegistryPath, "utf8");
  return tagRegistrySchema.parse(JSON.parse(rawRegistry) as unknown);
}
