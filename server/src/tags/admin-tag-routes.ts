import type { Express } from "express";
import { z } from "zod";

import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import { requireAdminActor } from "../definitions/admin-definition-routes";
import {
  TagRegistryService,
  TagRegistryValidationError,
} from "./tag-registry-service";
import {
  scanDefinitionTagUsage,
  validateDefinitionTagsAgainstRegistry,
  validateTagRegistry,
} from "./tag-validation";

const bodySchema = z.object({
  categories: z.unknown(),
});

export function registerAdminTagRoutes(
  app: Express,
  tagRegistryService: TagRegistryService,
  multiplayerRepository: MultiplayerRepository,
  definitionRoot: string,
): void {
  app.put("/api/admin/tags", async (request, response, next) => {
    try {
      const actor = await requireAdminActor(request, response, multiplayerRepository);
      if (!actor) {
        return;
      }

      const payload = bodySchema.parse(request.body);
      const registry = tagRegistryService.parseRegistry(payload);
      tagRegistryService.validateRegistry(registry);
      const registryValidation = validateTagRegistry(registry);
      const usageScan = await scanDefinitionTagUsage(definitionRoot);
      const usageValidation = validateDefinitionTagsAgainstRegistry(registry, usageScan);
      const issues = [...registryValidation.errors, ...usageValidation.errors];

      if (issues.length > 0) {
        response.status(400).json({
          error: "invalid_tag_registry",
          message: "Tag registry validation failed.",
          issues,
          warnings: [...registryValidation.warnings, ...usageValidation.warnings],
        });
        return;
      }

      await tagRegistryService.writeRegistry(registry);
      await multiplayerRepository.markSessionSeen(actor.sessionId);
      await multiplayerRepository.markPlayerSeen(actor.playerUuid);

      response.setHeader("Cache-Control", "no-cache").json({
        categories: registry.categories,
        warnings: [...registryValidation.warnings, ...usageValidation.warnings],
      });
    } catch (error) {
      if (error instanceof TagRegistryValidationError) {
        response.status(400).json({
          error: "invalid_tag_registry",
          message: "Tag registry validation failed.",
          issues: error.issues,
        });
        return;
      }

      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "bad_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      next(error);
    }
  });
}
