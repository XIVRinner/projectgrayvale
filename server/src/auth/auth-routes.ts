import { Router } from "express";

import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import {
  clearSessionCookie,
  extractSessionId,
} from "./session-auth";

export function createAuthRouter(repository: MultiplayerRepository): Router {
  const router = Router();

  router.get("/me", async (request, response, next) => {
    try {
      const sessionId = extractSessionId(request);

      if (!sessionId) {
        response.json({
          authenticated: false,
          admin: false,
        });
        return;
      }

      const session = await repository.getSession(sessionId);

      if (!session) {
          clearSessionCookie(response, request);
        response.json({
          authenticated: false,
          admin: false,
        });
        return;
      }

      const player = await repository.getAllowedPlayer(session.profileId);

      if (!player || player.serverBanned) {
          clearSessionCookie(response, request);
        response.json({
          authenticated: false,
          admin: false,
        });
        return;
      }

      await repository.markSessionSeen(sessionId);
      await repository.markPlayerSeen(player.profileId);

      response.json({
        authenticated: true,
        admin: player.rank === "admin",
        username: player.profileId,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
