import { Router, type Request, type Response } from "express";

import { ContentRepository } from "./content-repository";

export function createContentRouter(repository: ContentRepository): Router {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      const resources = await repository.listResources();
      response.json({
        count: resources.length,
        resources: resources.map((resource) => ({
          resourceKey: resource.resourceKey,
          updatedAt: resource.updatedAt,
          checksum: resource.checksum
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(/\/(.+)/, async (request, response, next) => {
    try {
      const key = normalizeResourceKey(request);
      const resource = await repository.getResource(key);

      if (!resource) {
        response.status(404).json({
          error: "not_found",
          message: `No JSON resource found for "${key}".`
        });
        return;
      }

      if (matchesEtag(request, resource.checksum)) {
        response.status(304).end();
        return;
      }

      response
        .setHeader("Cache-Control", "no-cache")
        .setHeader("ETag", `"${resource.checksum}"`)
        .type("application/json")
        .send(resource.payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function normalizeResourceKey(request: Request): string {
  const raw = String(request.params[0] ?? "").replace(/^\/+/, "").trim();

  if (!raw) {
    throw new Error("JSON resource key is required.");
  }

  return raw.endsWith(".json") ? raw : `${raw}.json`;
}

function matchesEtag(request: Request, checksum: string): boolean {
  const header = request.headers["if-none-match"];

  if (!header) {
    return false;
  }

  const expected = `"${checksum}"`;
  const values = String(header)
    .split(",")
    .map((entry) => entry.trim());

  return values.includes(expected);
}
