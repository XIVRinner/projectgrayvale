import type { Express, Request, Response } from "express";
import { z } from "zod";

import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import { clearSessionCookie, extractSessionId } from "../auth/session-auth";
import { AdminDefinitionService } from "./admin-definition-service";
import { DefinitionValidationError } from "./admin-definition-validation";
import type { DefinitionType } from "./definition-types";

const routeDefinitions: ReadonlyArray<{
  readonly type: DefinitionType;
  readonly path: string;
}> = [
  { type: "items", path: "/api/admin/definitions/items/:id" },
  { type: "materials", path: "/api/admin/definitions/materials/:id" },
  { type: "locations", path: "/api/admin/definitions/locations/:id" },
  { type: "activities", path: "/api/admin/definitions/activities/:id" },
  { type: "actions", path: "/api/admin/definitions/actions/:id" },
];
const bodySchema = z.object({
  definition: z.unknown(),
});

export function registerAdminDefinitionRoutes(
  app: Express,
  service: AdminDefinitionService,
  multiplayerRepository: MultiplayerRepository,
): void {
  for (const routeDefinition of routeDefinitions) {
    app.put(routeDefinition.path, async (request, response, next) => {
      try {
        const actor = await requireAdminActor(
          request,
          response,
          multiplayerRepository,
        );

        if (!actor) {
          return;
        }

        const id = readDefinitionId(request);
        const payload = bodySchema.parse(request.body);
        const saved = await service.saveDefinition(
          routeDefinition.type,
          id,
          payload.definition,
        );

        await multiplayerRepository.markSessionSeen(actor.sessionId);
        await multiplayerRepository.markPlayerSeen(actor.playerUuid);

        response.setHeader("Cache-Control", "no-cache").json(saved);
      } catch (error) {
        if (error instanceof DefinitionValidationError) {
          response.status(400).json({
            error: "invalid_definition",
            message: error.message,
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
}

export async function requireAdminActor(
  request: Request,
  response: Response,
  multiplayerRepository: MultiplayerRepository,
): Promise<{ sessionId: string; playerUuid: string } | null> {
  const sessionId = extractSessionId(request);

  if (!sessionId) {
    response.status(401).json({
      error: "invalid_session",
      message: "Admin authentication is required.",
    });
    return null;
  }

  const session = await multiplayerRepository.getSession(sessionId);

  if (!session) {
    clearSessionCookie(response, request);
    response.status(401).json({
      error: "invalid_session",
      message: "Session is invalid or expired.",
    });
    return null;
  }

  const player = await multiplayerRepository.getAllowedPlayer(session.playerUuid);

  if (!player || player.serverBanned) {
    clearSessionCookie(response, request);
    response.status(403).json({
      error: "forbidden",
      message: "Admin rank is required.",
    });
    return null;
  }

  if (player.rank !== "admin") {
    response.status(403).json({
      error: "forbidden",
      message: "Admin rank is required.",
    });
    return null;
  }

  return {
    sessionId,
    playerUuid: player.playerUuid,
  };
}

function readDefinitionId(request: Request): string {
  const rawId = request.params["id"];
  const id = typeof rawId === "string" ? rawId.trim() : "";

  if (!id) {
    throw new Error("Definition id is required.");
  }

  return id;
}
