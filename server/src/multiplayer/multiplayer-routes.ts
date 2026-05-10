import { Router, type Request } from "express";
import { z } from "zod";

import type { ServerConfig } from "../config";
import { MultiplayerRepository } from "./multiplayer-repository";
import { type PlayerRank } from "./multiplayer-types";

const playerUuidSchema = z.string().trim().uuid();
const clientIdSchema = z.string().trim().min(1).max(120);
const passwordSchema = z.string().min(1).max(200);
const displayNameSchema = z.string().trim().min(1).max(80).optional();
const joinBodySchema = z.object({
  playerUuid: playerUuidSchema,
  password: passwordSchema,
  clientId: clientIdSchema,
  displayName: displayNameSchema
});
const registerBodySchema = z.object({
  playerUuid: playerUuidSchema,
  password: passwordSchema,
  displayName: displayNameSchema
});
const rankSchema = z.enum(["player", "vip", "moderator", "admin"]);
const chatMessageSchema = z.string().trim().min(1).max(500);

export function createMultiplayerRouter(
  repository: MultiplayerRepository,
  config: ServerConfig
): Router {
  const router = Router();
  const authRateLimiter = createRateLimiter(5, 60_000);

  router.get("/info", (_request, response) => {
    response.json({
      name: config.name,
      port: config.port,
      defaultClientId: config.clientId,
      ranks: rankSchema.options,
      passwordLockSupported: true
    });
  });

  router.post("/register", async (request, response, next) => {
    try {
      if (!authRateLimiter.allow(request)) {
        response.status(429).json({
          error: "rate_limited",
          message: "Too many auth requests. Try again in a minute."
        });
        return;
      }

      const payload = registerBodySchema.parse(request.body);
      const player = await repository.registerPlayer(
        payload.playerUuid,
        payload.password,
        payload.displayName
      );

      await repository.appendAuditLog(
        "player_registered",
        { clientId: config.clientId },
        payload.playerUuid
      );

      response.status(201).json({
        player
      });
    } catch (error) {
      if (isErrorCode(error, "player_exists")) {
        response.status(409).json({
          error: "player_exists",
          message: "This player UUID is already registered."
        });
        return;
      }

      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "bad_request",
          message: error.issues.map((issue) => issue.message).join("; ")
        });
        return;
      }

      next(error);
    }
  });

  router.post("/join", async (request, response, next) => {
    try {
      if (!authRateLimiter.allow(request)) {
        response.status(429).json({
          error: "rate_limited",
          message: "Too many auth requests. Try again in a minute."
        });
        return;
      }

      const payload = joinBodySchema.parse(request.body);
      const player = await repository.authenticatePlayer(payload.playerUuid, payload.password);

      if (!player) {
        response.status(404).json({
          error: "player_not_registered",
          message: "Player UUID is not allowed on this server."
        });
        return;
      }

      const session = await repository.createSession(
        payload.playerUuid,
        payload.clientId,
        readIpAddress(request)
      );

      await repository.appendAuditLog(
        "player_joined",
        {
          sessionId: session.sessionId,
          clientId: payload.clientId,
          ipAddress: readIpAddress(request)
        },
        payload.playerUuid
      );

      response.json({
        session,
        player
      });
    } catch (error) {
      if (isErrorCode(error, "invalid_password")) {
        response.status(401).json({
          error: "invalid_password",
          message: "Player password is invalid."
        });
        return;
      }

      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "bad_request",
          message: error.issues.map((issue) => issue.message).join("; ")
        });
        return;
      }

      next(error);
    }
  });

  router.get("/chat", async (request, response, next) => {
    try {
      const limit = parseLimit(request.query["limit"]);
      const entries = await repository.listChatMessages(limit);

      response.json({
        count: entries.length,
        entries
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/chat", async (request, response, next) => {
    try {
      const sessionId = z.string().uuid().parse(request.body?.sessionId);
      const message = chatMessageSchema.parse(request.body?.message);
      const session = await repository.getSession(sessionId);

      if (!session) {
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired."
        });
        return;
      }

      const player = await repository.getAllowedPlayer(session.playerUuid);

      if (!player) {
        response.status(404).json({
          error: "player_not_registered",
          message: "Player no longer exists in the allow-list."
        });
        return;
      }

      const entry = await repository.appendChatMessage(session.playerUuid, player.rank, message);
      await repository.markSessionSeen(sessionId);
      await repository.markPlayerSeen(session.playerUuid);
      await repository.appendAuditLog(
        "chat_message",
        {
          sessionId,
          chatMessageId: entry.id
        },
        session.playerUuid
      );

      response.status(201).json({
        entry
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "bad_request",
          message: error.issues.map((issue) => issue.message).join("; ")
        });
        return;
      }

      if (isErrorCode(error, "invalid_chat_message")) {
        response.status(400).json({
          error: "invalid_chat_message",
          message: "Chat message cannot be empty."
        });
        return;
      }

      next(error);
    }
  });

  router.post("/admin/grant", async (request, response, next) => {
    try {
      if (!authRateLimiter.allow(request)) {
        response.status(429).json({
          error: "rate_limited",
          message: "Too many admin requests. Try again in a minute."
        });
        return;
      }

      const sessionId = z.string().uuid().parse(request.body?.sessionId);
      const targetUuid = playerUuidSchema.parse(request.body?.targetUuid);
      const targetRank = rankSchema.parse(request.body?.rank);
      const adminPassword = passwordSchema.parse(request.body?.adminPassword);

      if (adminPassword !== config.adminPassword) {
        response.status(403).json({
          error: "forbidden",
          message: "Admin password is invalid."
        });
        return;
      }

      const actorSession = await repository.getSession(sessionId);

      if (!actorSession) {
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired."
        });
        return;
      }

      const updated = await repository.setPlayerRank(targetUuid, targetRank);

      if (!updated) {
        response.status(404).json({
          error: "player_not_registered",
          message: "Target player UUID is not registered."
        });
        return;
      }

      await repository.appendAuditLog(
        "rank_changed",
        {
          actorPlayerUuid: actorSession.playerUuid,
          targetUuid,
          rank: targetRank
        },
        targetUuid
      );

      response.json({
        player: updated
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "bad_request",
          message: error.issues.map((issue) => issue.message).join("; ")
        });
        return;
      }

      next(error);
    }
  });

  router.post("/admin/verify", (request, response) => {
    if (!authRateLimiter.allow(request)) {
      response.status(429).json({
        error: "rate_limited",
        message: "Too many admin requests. Try again in a minute."
      });
      return;
    }

    const adminPassword = request.body?.adminPassword;

    if (typeof adminPassword !== "string") {
      response.status(400).json({
        error: "bad_request",
        message: "adminPassword must be provided."
      });
      return;
    }

    response.json({
      ok: adminPassword === config.adminPassword
    });
  });

  router.get("/audit", async (request, response, next) => {
    try {
      const limit = parseLimit(request.query["limit"]);
      const playerUuid = optionalUuid(request.query["playerUuid"]);
      const logs = await repository.listAuditLogs(limit, playerUuid);

      response.json({
        count: logs.length,
        logs: logs.map((log) => ({
          ...log,
          details: safeParseJson(log.detailsJson)
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseLimit(raw: unknown): number {
  if (typeof raw !== "string") {
    return 100;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 100;
  }

  return parsed;
}

function optionalUuid(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const parsed = playerUuidSchema.safeParse(raw);

  return parsed.success ? parsed.data : undefined;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readIpAddress(request: Request): string | undefined {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim();
  }

  return request.ip;
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}

export function isPlayerRank(value: string): value is PlayerRank {
  return rankSchema.safeParse(value).success;
}

function createRateLimiter(maxRequests: number, windowMs: number): {
  allow: (request: Request) => boolean;
} {
  const requestsByIp = new Map<string, { count: number; windowStart: number }>();

  return {
    allow(request: Request): boolean {
      const now = Date.now();
      const ip = readIpAddress(request) ?? "unknown";
      const current = requestsByIp.get(ip);

      if (!current || now - current.windowStart >= windowMs) {
        requestsByIp.set(ip, { count: 1, windowStart: now });
        return true;
      }

      if (current.count >= maxRequests) {
        return false;
      }

      requestsByIp.set(ip, {
        count: current.count + 1,
        windowStart: current.windowStart
      });
      return true;
    }
  };
}
