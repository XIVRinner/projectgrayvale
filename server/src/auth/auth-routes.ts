import { Router, type Request, type Response } from "express";
import { z } from "zod";

import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";

const sessionIdSchema = z.string().uuid();
const sessionCookieName = "grayvale_session";

export function createAuthRouter(repository: MultiplayerRepository): Router {
  const router = Router();

  router.get("/me", async (request, response, next) => {
    try {
      const sessionId = resolveSessionId(request);

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

      const player = await repository.getAllowedPlayer(session.playerUuid);

      if (!player || player.serverBanned) {
        clearSessionCookie(response, request);
        response.json({
          authenticated: false,
          admin: false,
        });
        return;
      }

      await repository.markSessionSeen(sessionId);
      await repository.markPlayerSeen(player.playerUuid);

      response.json({
        authenticated: true,
        admin: player.rank === "admin",
        username: player.playerUuid,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function resolveSessionId(request: Request): string | undefined {
  return (
    optionalSessionId(request.body?.sessionId) ??
    optionalSessionId(request.query["sessionId"]) ??
    optionalSessionId(readCookie(request, sessionCookieName))
  );
}

function optionalSessionId(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const parsed = sessionIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function readCookie(request: Request, key: string): string | undefined {
  const rawCookieHeader = request.headers["cookie"];

  if (typeof rawCookieHeader !== "string" || rawCookieHeader.trim().length === 0) {
    return undefined;
  }

  for (const segment of rawCookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = segment.split("=");
    const name = rawName?.trim();

    if (name !== key) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    if (!rawValue) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return undefined;
}

function clearSessionCookie(response: Response, request: Request): void {
  const secure = isSecureRequest(request);

  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    path: "/",
  });
}

function isSecureRequest(request: Request): boolean {
  if (request.secure) {
    return true;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  return typeof forwardedProto === "string" && forwardedProto.includes("https");
}
