import { readFile } from "node:fs/promises";

import { Router } from "express";
import { z } from "zod";

import { definitionTypes } from "../definitions/definition-types";

const allowedTagTargets = [...definitionTypes, "skills"] as const;

const tagRegistrySchema = z.object({
  categories: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      description: z.string(),
      allowedFor: z.array(z.enum(allowedTagTargets)).min(1),
      tags: z.array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1),
          description: z.string(),
        }),
      ),
    }),
  ),
});

export function createTagRegistryRouter(tagRegistryPath: string): Router {
  const router = Router();
  let registryPromise: Promise<z.infer<typeof tagRegistrySchema>> | null = null;

  router.get("/", async (_request, response, next) => {
    try {
      const registry = await getRegistry();
      response.setHeader("Cache-Control", "no-cache").json(registry);
    } catch (error) {
      next(error);
    }
  });

  return router;

  function getRegistry(): Promise<z.infer<typeof tagRegistrySchema>> {
    if (!registryPromise) {
      registryPromise = readRegistryFile(tagRegistryPath);
    }

    return registryPromise;
  }
}

async function readRegistryFile(
  tagRegistryPath: string,
): Promise<z.infer<typeof tagRegistrySchema>> {
  const rawRegistry = await readFile(tagRegistryPath, "utf8");
  return tagRegistrySchema.parse(JSON.parse(rawRegistry) as unknown);
}
