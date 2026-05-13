import type { Express, Request, Response } from "express";
import { z } from "zod";

import type { DefinitionAssetService } from "./definition-asset-service";
import { definitionTypes, type DefinitionType } from "./definition-types";

const assetTypeSchema = z.enum(definitionTypes);

export function registerDefinitionAssetRoutes(app: Express, service: DefinitionAssetService): void {
  app.get("/api/assets/:type/:assetId/info", async (request, response, next) => {
    try {
      const type = readAssetType(request);
      const assetId = readAssetId(request);
      const asset = await service.getAssetInfo(type, assetId);

      if (!asset) {
        respondNotFound(response, type, assetId);
        return;
      }

      response.setHeader("Cache-Control", "no-cache").setHeader("ETag", `"${asset.hash}"`).json(asset);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/assets/:type/:assetId", async (request, response, next) => {
    try {
      const type = readAssetType(request);
      const assetId = readAssetId(request);
      const asset = await service.getAsset(type, assetId);

      if (!asset) {
        respondNotFound(response, type, assetId);
        return;
      }

      response
        .setHeader("Cache-Control", "no-cache")
        .setHeader("Content-Type", asset.contentType)
        .setHeader("ETag", `"${asset.hash}"`)
        .setHeader("Last-Modified", new Date(asset.updatedAt).toUTCString())
        .send(asset.body);
    } catch (error) {
      next(error);
    }
  });
}

function readAssetType(request: Request): DefinitionType {
  return assetTypeSchema.parse(request.params["type"]);
}

function readAssetId(request: Request): string {
  const rawAssetId = request.params["assetId"];
  const assetId = typeof rawAssetId === "string" ? rawAssetId.trim() : "";

  if (!assetId) {
    throw new Error("Asset id is required for /api/assets/:type/:assetId.");
  }

  return assetId;
}

function respondNotFound(response: Response, type: DefinitionType, assetId: string): void {
  response.status(404).json({
    error: "not_found",
    message: `No ${type} asset found for "${assetId}".`,
  });
}
