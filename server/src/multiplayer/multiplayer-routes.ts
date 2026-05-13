import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import type { ServerConfig } from "../config";
import type { SocialRepository } from "../social/social-repository";
import { MultiplayerRepository } from "./multiplayer-repository";
import { type AllowedPlayerRecord, type PlayerRank } from "./multiplayer-types";
import { buildServerProfile } from "../server-profile/server-profile-service";

const playerUuidSchema = z.string().trim().uuid();
const clientIdSchema = z.string().trim().min(1).max(120);
const passwordSchema = z.string().min(1).max(200);
const displayNameSchema = z.string().trim().min(1).max(80).optional();
const avatarPathSchema = z.string().trim().min(1).max(300).optional();
const joinBodySchema = z.object({
  playerUuid: playerUuidSchema,
  password: passwordSchema,
  clientId: clientIdSchema,
  displayName: displayNameSchema,
  avatarPath: avatarPathSchema,
});
const registerBodySchema = z.object({
  playerUuid: playerUuidSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  avatarPath: avatarPathSchema,
});
const rankSchema = z.enum(["player", "vip", "moderator", "admin"]);
const chatMessageSchema = z.string().trim().min(1).max(500);
const sessionIdSchema = z.string().uuid();
const moderationActionSchema = z.enum(["timeout", "ban", "clear"]);
const moderationReasonSchema = z.string().trim().min(3).max(300);
const moderationDurationSchema = z.number().int().min(1).max(43_200);
const moderationBodySchema = z
  .object({
    targetUuid: playerUuidSchema,
    action: moderationActionSchema,
    durationMinutes: moderationDurationSchema.optional(),
    reason: moderationReasonSchema.optional(),
    blockServerEntry: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "timeout" && value.durationMinutes === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "durationMinutes is required for timeouts.",
        path: ["durationMinutes"],
      });
    }

    if (
      (value.action === "timeout" || value.action === "ban") &&
      (!value.reason || value.reason.trim().length < 3)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reason is required for moderation actions.",
        path: ["reason"],
      });
    }
  });
const SESSION_COOKIE_NAME = "grayvale_session";

export function createMultiplayerRouter(
  repository: MultiplayerRepository,
  config: ServerConfig,
  socialRepository?: SocialRepository,
): Router {
  const router = Router();

  // 5 auth actions per minute — covers register, join, grant, verify
  const enforceAuthRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many auth requests. Try again in a minute.",
    },
  });

  // 60 read requests per minute — covers session, presence, chat listing, audit
  const enforceReadRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many requests. Try again in a minute.",
    },
  });

  // 30 chat posts per minute
  const enforceChatWriteRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many chat messages. Try again in a minute.",
    },
  });

  // 10 moderation actions per minute
  const enforceModerationRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many moderation actions. Try again in a minute.",
    },
  });

  router.get("/info", (_request, response) => {
    response.json({
      name: config.name,
      port: config.port,
      defaultClientId: config.clientId,
      ranks: rankSchema.options,
      passwordLockSupported: true,
    });
  });

  /**
   * GET /api/server/profile
   * Returns limited public server information and a signed compatibility token.
   * This endpoint is public — no authentication required.
   * The clientSecret is used to sign the token but is never returned.
   */
  router.get("/profile", (_request, response) => {
    response.json(buildServerProfile(config));
  });

  router.get("/session", enforceReadRateLimit, async (request, response, next) => {
    try {
      const sessionId = resolveSessionId(request);

      if (!sessionId) {
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired.",
        });
        return;
      }

      const session = await repository.getSession(sessionId);

      if (!session) {
        clearSessionCookie(response, request);
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired.",
        });
        return;
      }

      const player = await repository.getAllowedPlayer(session.playerUuid);

      if (!player) {
        clearSessionCookie(response, request);
        response.status(404).json({
          error: "player_not_registered",
          message: "Player no longer exists in the allow-list.",
        });
        return;
      }

      if (player.serverBanned) {
        await repository.deleteSessionsForPlayer(player.playerUuid);
        clearSessionCookie(response, request);
        response.status(403).json({
          error: "server_banned",
          message: player.serverBanReason
            ? `Server access revoked: ${player.serverBanReason}`
            : "This player is banned from entering the server.",
        });
        return;
      }

      if (socialRepository) {
        const profileId = await socialRepository.getProfileIdByCharacterId(session.playerUuid);

        if (profileId && (await socialRepository.isProfileBanned(profileId))) {
          await repository.deleteSessionsForPlayer(session.playerUuid);
          clearSessionCookie(response, request);
          response.status(403).json({
            error: "server_banned",
            message: "This profile is banned from entering the server.",
          });
          return;
        }
      }

      await repository.markSessionSeen(sessionId);
      await repository.markPlayerSeen(session.playerUuid);

      response.json({
        session,
        player,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/presence", enforceReadRateLimit, async (request, response, next) => {
    try {
      const limit = parseLimit(request.query["limit"]);
      const sessionId = resolveSessionId(request);

      if (sessionId) {
        const session = await repository.getSession(sessionId);

        if (!session) {
          clearSessionCookie(response, request);
          response.status(401).json({
            error: "invalid_session",
            message: "Session is invalid or expired.",
          });
          return;
        }

        const player = await repository.getAllowedPlayer(session.playerUuid);

        if (player?.serverBanned) {
          await repository.deleteSessionsForPlayer(session.playerUuid);
          clearSessionCookie(response, request);
          response.status(403).json({
            error: "server_banned",
            message: player.serverBanReason
              ? `Server access revoked: ${player.serverBanReason}`
              : "This player is banned from entering the server.",
          });
          return;
        }

        if (socialRepository) {
          const profileId = await socialRepository.getProfileIdByCharacterId(session.playerUuid);

          if (profileId && (await socialRepository.isProfileBanned(profileId))) {
            await repository.deleteSessionsForPlayer(session.playerUuid);
            clearSessionCookie(response, request);
            response.status(403).json({
              error: "server_banned",
              message: "This profile is banned from entering the server.",
            });
            return;
          }
        }

        await repository.markSessionSeen(sessionId);
        await repository.markPlayerSeen(session.playerUuid);
      }

      const players = await repository.listOnlinePlayers(limit);
      const hydratedPlayers = socialRepository
        ? await Promise.all(
            players.map(async (player) => {
              const profileId =
                (await socialRepository.getProfileIdByCharacterId(
                  player.playerUuid,
                )) ?? undefined;
              const guildShortName =
                (await socialRepository.getGuildShortNameByCharacterId(
                  player.playerUuid,
                )) ?? undefined;

              return {
                ...player,
                profileId,
                guildShortName,
              };
            }),
          )
        : players;

      response.json({
        server: {
          name: config.name,
          port: config.port,
          defaultClientId: config.clientId,
          passwordLockSupported: true,
        },
        count: hydratedPlayers.length,
        players: hydratedPlayers,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/register",
    enforceAuthRateLimit,
    async (request, response, next) => {
      try {
        const payload = registerBodySchema.parse(request.body);
        const player = await repository.registerPlayer(
          payload.playerUuid,
          payload.password,
          payload.displayName,
          payload.avatarPath,
        );

        await repository.appendAuditLog(
          "player_registered",
          { clientId: config.clientId },
          payload.playerUuid,
        );

        response.status(201).json({
          player,
        });
      } catch (error) {
        if (isErrorCode(error, "player_exists")) {
          response.status(409).json({
            error: "player_exists",
            message: "This player UUID is already registered.",
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
    },
  );

  router.post(
    "/join",
    enforceAuthRateLimit,
    async (request, response, next) => {
      try {
        const payload = joinBodySchema.parse(request.body);
        const player = await repository.authenticatePlayer(
          payload.playerUuid,
          payload.password,
        );

        if (!player) {
          response.status(404).json({
            error: "player_not_registered",
            message: "Player UUID is not allowed on this server.",
          });
          return;
        }

        if (player.serverBanned) {
          response.status(403).json({
            error: "server_banned",
            message: player.serverBanReason
              ? `Server access revoked: ${player.serverBanReason}`
              : "This player is banned from entering the server.",
          });
          return;
        }

        if (socialRepository) {
          const profileId = await socialRepository.getProfileIdByCharacterId(payload.playerUuid);

          if (profileId && (await socialRepository.isProfileBanned(profileId))) {
            response.status(403).json({
              error: "server_banned",
              message: "This profile is banned from entering the server.",
            });
            return;
          }
        }

        const session = await repository.createSession(
          payload.playerUuid,
          payload.clientId,
          readIpAddress(request),
        );
        await repository.syncPlayerProfile(payload.playerUuid, {
          displayName: payload.displayName,
          avatarPath: payload.avatarPath,
        });
        setSessionCookie(response, session.sessionId, request);

        await repository.appendAuditLog(
          "player_joined",
          {
            sessionId: session.sessionId,
            clientId: payload.clientId,
            ipAddress: readIpAddress(request),
          },
          payload.playerUuid,
        );

        response.json({
          session,
          player,
        });
      } catch (error) {
        if (isErrorCode(error, "invalid_password")) {
          response.status(401).json({
            error: "invalid_password",
            message: "Player password is invalid.",
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
    },
  );

  router.get("/chat", enforceReadRateLimit, async (request, response, next) => {
    try {
      const limit = parseLimit(request.query["limit"]);
      const entries = await repository.listChatMessages(limit);

      response.json({
        count: entries.length,
        entries,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/chat", enforceChatWriteRateLimit, async (request, response, next) => {
    try {
      const sessionId = resolveSessionId(request);
      const message = chatMessageSchema.parse(request.body?.message);

      if (!sessionId) {
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired.",
        });
        return;
      }

      const session = await repository.getSession(sessionId);

      if (!session) {
        clearSessionCookie(response, request);
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired.",
        });
        return;
      }

      const player = await repository.getAllowedPlayer(session.playerUuid);

      if (!player) {
        response.status(404).json({
          error: "player_not_registered",
          message: "Player no longer exists in the allow-list.",
        });
        return;
      }

      const chatBlockedMessage = resolveChatBlockedMessage(player);

      if (chatBlockedMessage) {
        response.status(403).json({
          error:
            player.chatAccess === "timed_out" ? "chat_timed_out" : "chat_banned",
          message: chatBlockedMessage,
        });
        return;
      }

      if (socialRepository) {
        const profileId = await socialRepository.getProfileIdByCharacterId(session.playerUuid);

        if (profileId && (await socialRepository.isProfileMuted(profileId))) {
          response.status(403).json({
            error: "chat_muted",
            message: "This profile is muted and cannot send chat messages.",
          });
          return;
        }
      }

      const entry = await repository.appendChatMessage(
        session.playerUuid,
        player.rank,
        message,
      );
      await repository.markSessionSeen(sessionId);
      await repository.markPlayerSeen(session.playerUuid);
      await repository.appendAuditLog(
        "chat_message",
        {
          sessionId,
          chatMessageId: entry.id,
        },
        session.playerUuid,
      );

      response.status(201).json({
        entry,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "bad_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      if (isErrorCode(error, "invalid_chat_message")) {
        response.status(400).json({
          error: "invalid_chat_message",
          message: "Chat message cannot be empty.",
        });
        return;
      }

      next(error);
    }
  });

  router.post(
    "/admin/moderation",
    enforceModerationRateLimit,
    async (request, response, next) => {
      try {
        const payload = moderationBodySchema.parse(request.body);
        const actorSessionId = resolveSessionId(request);

        if (!actorSessionId) {
          response.status(401).json({
            error: "invalid_session",
            message: "Session is invalid or expired.",
          });
          return;
        }

        const actorSession = await repository.getSession(actorSessionId);

        if (!actorSession) {
          clearSessionCookie(response, request);
          response.status(401).json({
            error: "invalid_session",
            message: "Session is invalid or expired.",
          });
          return;
        }

        const actorPlayer = await repository.getAllowedPlayer(
          actorSession.playerUuid,
        );

        if (!actorPlayer) {
          response.status(404).json({
            error: "player_not_registered",
            message: "Acting player no longer exists in the allow-list.",
          });
          return;
        }

        if (!canModeratePlayers(actorPlayer.rank)) {
          response.status(403).json({
            error: "forbidden",
            message: "Moderator or admin rank is required.",
          });
          return;
        }

        if (actorPlayer.playerUuid === payload.targetUuid) {
          response.status(400).json({
            error: "bad_request",
            message: "You cannot moderate your own character.",
          });
          return;
        }

        const targetPlayer = await repository.getAllowedPlayer(payload.targetUuid);

        if (!targetPlayer) {
          response.status(404).json({
            error: "player_not_registered",
            message: "Target player UUID is not registered.",
          });
          return;
        }

        if (!canAffectTarget(actorPlayer.rank, targetPlayer.rank)) {
          response.status(403).json({
            error: "forbidden",
            message: "Your rank cannot moderate that player.",
          });
          return;
        }

        if (
          payload.action === "ban" &&
          payload.blockServerEntry &&
          actorPlayer.rank !== "admin"
        ) {
          response.status(403).json({
            error: "forbidden",
            message: "Only admins can revoke server entry.",
          });
          return;
        }

        const updated =
          payload.action === "timeout"
            ? await repository.applyModeration(payload.targetUuid, {
                action: "timeout",
                actorPlayerUuid: actorPlayer.playerUuid,
                reason: payload.reason!,
                timeoutUntil: new Date(
                  Date.now() + payload.durationMinutes! * 60_000,
                ).toISOString(),
              })
            : payload.action === "ban"
              ? await repository.applyModeration(payload.targetUuid, {
                  action: "ban",
                  actorPlayerUuid: actorPlayer.playerUuid,
                  reason: payload.reason!,
                  blockServerEntry: Boolean(payload.blockServerEntry),
                })
              : await repository.applyModeration(payload.targetUuid, {
                  action: "clear",
                  actorPlayerUuid: actorPlayer.playerUuid,
                  reason: payload.reason,
                });

        if (!updated) {
          response.status(404).json({
            error: "player_not_registered",
            message: "Target player UUID is not registered.",
          });
          return;
        }

        await repository.appendAuditLog(
          `moderation_${payload.action}`,
          {
            actorPlayerUuid: actorPlayer.playerUuid,
            targetUuid: payload.targetUuid,
            action: payload.action,
            reason: payload.reason ?? null,
            durationMinutes: payload.durationMinutes ?? null,
            blockServerEntry: Boolean(payload.blockServerEntry),
          },
          payload.targetUuid,
        );

        response.json({
          player: updated,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "bad_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post(
    "/admin/grant",
    enforceAuthRateLimit,
    async (request, response, next) => {
      try {
        const sessionId = z.string().uuid().parse(request.body?.sessionId);
        const targetUuid = playerUuidSchema.parse(request.body?.targetUuid);
        const targetRank = rankSchema.parse(request.body?.rank);
        const adminPassword = passwordSchema.parse(request.body?.adminPassword);

        if (!safePasswordCompare(adminPassword, config.adminPassword)) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin password is invalid.",
          });
          return;
        }

        const actorSession = await repository.getSession(sessionId);

        if (!actorSession) {
          response.status(401).json({
            error: "invalid_session",
            message: "Session is invalid or expired.",
          });
          return;
        }

        const updated = await repository.setPlayerRank(targetUuid, targetRank);

        if (!updated) {
          response.status(404).json({
            error: "player_not_registered",
            message: "Target player UUID is not registered.",
          });
          return;
        }

        await repository.appendAuditLog(
          "rank_changed",
          {
            actorPlayerUuid: actorSession.playerUuid,
            targetUuid,
            rank: targetRank,
          },
          targetUuid,
        );

        response.json({
          player: updated,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "bad_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post("/admin/verify", enforceAuthRateLimit, (request, response) => {
    const adminPassword = request.body?.adminPassword;

    if (typeof adminPassword !== "string") {
      response.status(400).json({
        error: "bad_request",
        message: "adminPassword must be provided.",
      });
      return;
    }

    response.json({
      ok: safePasswordCompare(adminPassword, config.adminPassword),
    });
  });

  router.get("/audit", enforceReadRateLimit, async (request, response, next) => {
    try {
      // Audit logs contain sensitive data (IPs, session IDs, player UUIDs).
      // Access is restricted to moderators and admins.
      const actorSessionId = resolveSessionId(request);

      if (!actorSessionId) {
        response.status(401).json({
          error: "invalid_session",
          message: "Authentication required to access audit logs.",
        });
        return;
      }

      const actorSession = await repository.getSession(actorSessionId);

      if (!actorSession) {
        clearSessionCookie(response, request);
        response.status(401).json({
          error: "invalid_session",
          message: "Session is invalid or expired.",
        });
        return;
      }

      const actorPlayer = await repository.getAllowedPlayer(
        actorSession.playerUuid,
      );

      if (!actorPlayer) {
        response.status(403).json({
          error: "forbidden",
          message: "Insufficient permissions.",
        });
        return;
      }

      if (!canModeratePlayers(actorPlayer.rank)) {
        response.status(403).json({
          error: "forbidden",
          message: "Moderator or admin rank is required.",
        });
        return;
      }

      const limit = parseLimit(request.query["limit"]);
      const playerUuid = optionalUuid(request.query["playerUuid"]);
      const logs = await repository.listAuditLogs(limit, playerUuid);

      response.json({
        count: logs.length,
        logs: logs.map((log) => ({
          ...log,
          details: safeParseJson(log.detailsJson),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseLimit(raw: unknown, max = 100): number {
  // Route-layer first-line guard. The `max` parameter should match the
  // collection's repository-level ceiling (300 for chat, 200 for presence,
  // 500 for audit).  Callers that don't pass `max` default to 100, which is
  // below all repository ceilings and therefore safe.
  if (typeof raw !== "string") {
    return max;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return max;
  }

  return Math.min(parsed, max);
}

function optionalUuid(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const parsed = playerUuidSchema.safeParse(raw);

  return parsed.success ? parsed.data : undefined;
}

function optionalSessionId(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const parsed = sessionIdSchema.safeParse(raw);

  return parsed.success ? parsed.data : undefined;
}

function resolveSessionId(request: Request): string | undefined {
  return (
    optionalSessionId(request.body?.sessionId) ??
    optionalSessionId(request.query["sessionId"]) ??
    optionalSessionId(readCookie(request, SESSION_COOKIE_NAME))
  );
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

function readCookie(request: Request, key: string): string | undefined {
  const rawCookieHeader = request.headers["cookie"];

  if (
    typeof rawCookieHeader !== "string" ||
    rawCookieHeader.trim().length === 0
  ) {
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

function setSessionCookie(
  response: Response,
  sessionId: string,
  request: Request,
): void {
  const secure = isSecureRequest(request);

  response.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function clearSessionCookie(response: Response, request?: Request): void {
  const secure = request ? isSecureRequest(request) : false;

  response.clearCookie(SESSION_COOKIE_NAME, {
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

  return typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0]?.trim() === "https"
    : false;
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}

export function isPlayerRank(value: string): value is PlayerRank {
  return rankSchema.safeParse(value).success;
}

function safePasswordCompare(left: string, right: string): boolean {
  const leftBuffer = createHash("sha256").update(left).digest();
  const rightBuffer = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveChatBlockedMessage(player: AllowedPlayerRecord): string | null {
  if (player.chatAccess === "banned") {
    return player.chatReason
      ? `Chat access revoked: ${player.chatReason}`
      : "This player is banned from world chat.";
  }

  if (player.chatAccess === "timed_out") {
    const untilLabel = player.chatTimeoutUntil
      ? new Date(player.chatTimeoutUntil).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "later";

    return player.chatReason
      ? `Chat timed out until ${untilLabel}: ${player.chatReason}`
      : `Chat timed out until ${untilLabel}.`;
  }

  return null;
}

function canModeratePlayers(rank: PlayerRank): boolean {
  return rank === "moderator" || rank === "admin";
}

function canAffectTarget(actorRank: PlayerRank, targetRank: PlayerRank): boolean {
  return rankPriority(actorRank) > rankPriority(targetRank);
}

function rankPriority(rank: PlayerRank): number {
  switch (rank) {
    case "admin":
      return 4;
    case "moderator":
      return 3;
    case "vip":
      return 2;
    default:
      return 1;
  }
}
