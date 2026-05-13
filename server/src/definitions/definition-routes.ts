import type { Express, Request, Response } from "express";
import { z } from "zod";

import type { DefinitionService } from "./definition-service";
import type { DefinitionType } from "./definition-types";

const definitionIdsSchema = z.array(z.string().trim().min(1)).max(500);

const routeDefinitions: ReadonlyArray<{
  readonly type: DefinitionType;
  readonly listPath: string;
}> = [
  { type: "items", listPath: "/api/items" },
  { type: "materials", listPath: "/api/materials" },
  { type: "locations", listPath: "/api/locations" },
  { type: "activities", listPath: "/api/activities" },
  { type: "actions", listPath: "/api/actions" },
];

export function registerDefinitionRoutes(
  app: Express,
  service: DefinitionService,
): void {
  for (const routeDefinition of routeDefinitions) {
    app.get(routeDefinition.listPath, async (_request, response, next) => {
      try {
        const ids = await service.listIds(routeDefinition.type);
        response.setHeader("Cache-Control", "no-cache").json(ids);
      } catch (error) {
        next(error);
      }
    });

    app.get(
      `/api/definitions/${routeDefinition.type}/summaries`,
      async (_request, response, next) => {
        try {
          const definitions = await service.listSummaries(routeDefinition.type);
          response.setHeader("Cache-Control", "no-cache").json(definitions);
        } catch (error) {
          next(error);
        }
      },
    );

    app.get(
      `/api/definitions/${routeDefinition.type}/:id`,
      async (request, response, next) => {
        try {
          const id = readDefinitionId(request);
          const definition = await service.getById(routeDefinition.type, id);

          if (!definition) {
            response.status(404).json({
              error: "not_found",
              message: `No ${routeDefinition.type} definition found for "${id}".`,
            });
            return;
          }

          response
            .setHeader("Cache-Control", "no-cache")
            .setHeader("ETag", `"${definition.hash}"`)
            .json(definition.definition);
        } catch (error) {
          next(error);
        }
      },
    );

    app.post(
      `/api/definitions/${routeDefinition.type}/info`,
      async (request, response, next) => {
        try {
          const ids = definitionIdsSchema.parse(request.body);
          const definitions = await service.listMetadata(routeDefinition.type, ids);
          response.setHeader("Cache-Control", "no-cache").json(definitions);
        } catch (error) {
          next(error);
        }
      },
    );

    app.post(
      `/api/definitions/${routeDefinition.type}/batch`,
      async (request, response, next) => {
        try {
          const ids = definitionIdsSchema.parse(request.body);
          const definitions = await service.getManyByIds(routeDefinition.type, ids);
          response.setHeader("Cache-Control", "no-cache").json(definitions);
        } catch (error) {
          next(error);
        }
      },
    );
  }

  app.get("/api/inventory-items", async (_request, response, next) => {
    try {
      const definitions = await service.listInventoryDefinitions();
      response.setHeader("Cache-Control", "no-cache").json(definitions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/equipment-items", async (_request, response, next) => {
    try {
      const definitions = await service.listEquipmentDefinitions();
      response.setHeader("Cache-Control", "no-cache").json(definitions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/activity-definitions", async (_request, response, next) => {
    try {
      const definitions = await service.listActivityDefinitions();
      response.setHeader("Cache-Control", "no-cache").json(definitions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/action-definitions", async (_request, response, next) => {
    try {
      const definitions = await service.listActionDefinitions();
      response.setHeader("Cache-Control", "no-cache").json(definitions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/world-default-state/default", async (_request, response, next) => {
    try {
      const defaultState = await service.getLocationDefaults();
      response.setHeader("Cache-Control", "no-cache").json(defaultState);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/world-locations", async (_request, response, next) => {
    try {
      const locationBundle = await service.getLocationBundle();
      response.setHeader("Cache-Control", "no-cache").json(locationBundle);
    } catch (error) {
      next(error);
    }
  });
}

function readDefinitionId(request: Request): string {
  const rawId = request.params["id"];
  const id = typeof rawId === "string" ? rawId.trim() : "";

  if (!id) {
    throw new Error(
      "Definition id is required for /api/definitions/:type/:id.",
    );
  }

  return id;
}
