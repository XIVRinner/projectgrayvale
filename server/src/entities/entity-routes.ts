import type { Express, Request, Response } from "express";

import { EntityRepository } from "./entity-repository";

export function registerEntityRoutes(
  app: Express,
  basePath: string,
  entityType: string,
  repository: EntityRepository
): void {
  app.get(basePath, async (request, response, next) => {
    try {
      const entities = await repository.list(entityType, {
        tag: readOptionalString(request, "tag"),
        category: readOptionalString(request, "category"),
        slot: readOptionalString(request, "slot"),
        locationId: readOptionalString(request, "locationId"),
        limit: readOptionalInteger(request, "limit"),
        offset: readOptionalInteger(request, "offset")
      });

      response
        .setHeader("Cache-Control", "no-cache")
        .json(entities.map((entity) => JSON.parse(entity.payload)));
    } catch (error) {
      next(error);
    }
  });

  app.get(`${basePath}/:id`, async (request, response, next) => {
    try {
      const entityId = request.params["id"];

      if (!entityId) {
        response.status(400).json({
          error: "bad_request",
          message: "Entity id is required."
        });
        return;
      }

      const entity = await repository.get(entityType, entityId);

      if (!entity) {
        response.status(404).json({
          error: "not_found",
          message: `No ${entityType} found for "${entityId}".`
        });
        return;
      }

      response
        .setHeader("Cache-Control", "no-cache")
        .setHeader("ETag", `"${entity.checksum}"`)
        .json(JSON.parse(entity.payload));
    } catch (error) {
      next(error);
    }
  });
}

function readOptionalString(request: Request, key: string): string | undefined {
  const raw = request.query[key];

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return undefined;
  }

  return raw.trim();
}

function readOptionalInteger(request: Request, key: string): number | undefined {
  const raw = readOptionalString(request, key);

  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Query parameter "${key}" must be a non-negative integer.`);
  }

  return parsed;
}
