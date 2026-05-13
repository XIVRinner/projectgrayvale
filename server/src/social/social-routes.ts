import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { extractSessionId } from "../auth/session-auth";
import type { ServerConfig } from "../config";
import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import { SocialRepository } from "./social-repository";

const limitSchema = z.coerce.number().int().min(1).max(200).optional();
const joinChannelBodySchema = z.object({
  name: z.string().trim().min(1).max(32),
});
const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(500),
});
const profileTargetBodySchema = z.object({
  targetProfileId: z.string().trim().uuid(),
});
const ownerTransferBodySchema = z.object({
  targetProfileId: z.string().trim().uuid(),
});
const sendDirectBodySchema = z.object({
  targetCharacterName: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(500),
});
const friendAddBodySchema = z.object({
  target: z.string().trim().min(1).max(80),
});
const adminPermissionBodySchema = z.object({
  permissionId: z.string().trim().min(1).max(120),
});
const adminActionBodySchema = z.object({
  reason: z.string().trim().min(1).max(400).optional(),
  expiresAt: z.string().datetime().optional(),
});
const adminNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
const socialBlockBodySchema = z.object({
  blockedProfileId: z.string().uuid(),
  reason: z.string().trim().max(400).optional(),
});
const friendCharacterBodySchema = z.object({
  targetProfileId: z.string().uuid(),
  targetCharacterId: z.string().uuid().optional(),
});
const friendProfileRequestBodySchema = z.object({
  targetProfileId: z.string().uuid(),
});
const guildCreateBodySchema = z.object({
  name: z.string().trim().min(2).max(64),
});
const guildInviteBodySchema = z.object({
  targetProfileId: z.string().uuid(),
  targetCharacterId: z.string().uuid().optional(),
});
const guildRoleBodySchema = z.object({
  role: z.enum(["guild_master", "officer", "member", "recruit"]),
});
const privacySettingsBodySchema = z.object({
  showOnlineToFriends: z.boolean().optional(),
  allowFriendRequests: z.boolean().optional(),
  allowWhispersFrom: z.enum(["everyone", "friends", "none"]).optional(),
});
const reportBodySchema = z.object({
  targetProfileId: z.string().uuid().optional(),
  targetMessageId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(2000),
});

export function createSocialRouter(
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
  config: ServerConfig,
): Router {
  const router = Router();

  const enforceReadRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many social requests. Try again in a minute.",
    },
  });

  const enforceWriteRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many social actions. Try again in a minute.",
    },
  });

  const enforceMessageRateLimit = rateLimit({
    windowMs: 1_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many messages. Slow down.",
    },
  });

  const enforceCustomChannelCreateLimit = rateLimit({
    windowMs: 60 * 60 * 1_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many custom channels created this hour.",
    },
  });

  const enforceFriendRequestLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many friend requests today.",
    },
  });

  const enforceGuildInviteLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many guild invites today.",
    },
  });

  const enforceReportLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many reports today.",
    },
  });

  router.get("/chat/channels", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);

      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }

      await socialRepository.refreshPresenceFromSessions();
      const channels = await socialRepository.listChannelsForActor(actor);
      response.json({
        channels,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/chat/channels/join",
    enforceCustomChannelCreateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const payload = joinChannelBodySchema.parse(request.body);
        const result = await socialRepository.joinCustomChannel(actor, payload.name);

        response.status(result.created ? 201 : 200).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "reserved_channel_name")) {
          response.status(400).json({
            error: "reserved_channel_name",
            message: "That channel name is reserved.",
          });
          return;
        }

        if (isErrorCode(error, "invalid_channel_name")) {
          response.status(400).json({
            error: "invalid_channel_name",
            message: "Channel names must be <= 32 chars, no spaces, not empty.",
          });
          return;
        }

        if (isErrorCode(error, "channel_banned")) {
          response.status(403).json({
            error: "channel_banned",
            message: "You are banned from this channel.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post(
    "/chat/channels/:channelId/leave",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        await socialRepository.leaveCustomChannel(
          actor,
          routeParam(request.params["channelId"]),
        );
        response.status(204).send();
      } catch (error) {
        if (
          isErrorCode(error, "channel_not_found") ||
          isErrorCode(error, "forbidden")
        ) {
          response.status(404).json({
            error: "channel_not_found",
            message: "Channel membership not found.",
          });
          return;
        }

        if (isErrorCode(error, "channel_leave_not_allowed")) {
          response.status(400).json({
            error: "channel_leave_not_allowed",
            message: "Only custom channels can be left here.",
          });
          return;
        }

        if (isErrorCode(error, "owner_cannot_leave")) {
          response.status(409).json({
            error: "owner_cannot_leave",
            message: "Transfer ownership first.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post(
    "/chat/channels/:channelId/kick",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withChannelModerationAction(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        false,
      );
    },
  );

  router.post(
    "/chat/channels/:channelId/ban",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withChannelModerationAction(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        true,
      );
    },
  );

  router.post(
    "/chat/channels/:channelId/unban",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const payload = profileTargetBodySchema.parse(request.body);
        await socialRepository.unbanMember(
          actor,
          routeParam(request.params["channelId"]),
          payload.targetProfileId,
        );
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "forbidden")) {
          response.status(403).json({
            error: "forbidden",
            message: "Only the channel owner can do that.",
          });
          return;
        }

        if (isErrorCode(error, "channel_not_found")) {
          response.status(404).json({
            error: "channel_not_found",
            message: "Channel not found.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post(
    "/chat/channels/:channelId/transfer-owner",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const payload = ownerTransferBodySchema.parse(request.body);
        await socialRepository.transferOwner(
          actor,
          routeParam(request.params["channelId"]),
          payload.targetProfileId,
        );
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "forbidden")) {
          response.status(403).json({
            error: "forbidden",
            message: "Only the channel owner can do that.",
          });
          return;
        }

        if (isErrorCode(error, "channel_not_found")) {
          response.status(404).json({
            error: "channel_not_found",
            message: "Channel not found.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.get(
    "/chat/channels/:channelId/messages",
    enforceReadRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const limit = limitSchema.parse(request.query["limit"]) ?? 50;
        const after =
          typeof request.query["after"] === "string" ? request.query["after"] : undefined;
        const entries = await socialRepository.listChannelMessages(
          actor,
          routeParam(request.params["channelId"]),
          after,
          limit,
        );

        response.json({
          count: entries.length,
          entries,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "forbidden") || isErrorCode(error, "channel_banned")) {
          response.status(403).json({
            error: "forbidden",
            message: "Channel access denied.",
          });
          return;
        }

        if (isErrorCode(error, "channel_not_found")) {
          response.status(404).json({
            error: "channel_not_found",
            message: "Channel not found.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post(
    "/chat/channels/:channelId/messages",
    enforceMessageRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const payload = sendMessageBodySchema.parse(request.body);
        const slashResult = await tryHandleSlashCommand(
          socialRepository,
          actor,
          payload.body,
        );

        if (slashResult.handled) {
          response.status(slashResult.statusCode).json(slashResult.body);
          return;
        }

        const entry = await socialRepository.appendChannelMessage(
          actor,
          routeParam(request.params["channelId"]),
          payload.body,
        );
        response.status(201).json({ entry });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "invalid_chat_message")) {
          response.status(400).json({
            error: "invalid_chat_message",
            message: "Message cannot be empty.",
          });
          return;
        }

        if (isErrorCode(error, "unknown_command")) {
          response.status(400).json({
            error: "unknown_command",
            message: "Unknown command.",
          });
          return;
        }

        if (isErrorCode(error, "chat_blocked")) {
          response.status(403).json({
            error: "chat_blocked",
            message: "You cannot send messages right now.",
          });
          return;
        }

        if (isErrorCode(error, "forbidden") || isErrorCode(error, "channel_banned")) {
          response.status(403).json({
            error: "forbidden",
            message: "Channel access denied.",
          });
          return;
        }

        if (isErrorCode(error, "channel_not_found")) {
          response.status(404).json({
            error: "channel_not_found",
            message: "Channel not found.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post("/chat/direct", enforceMessageRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);

      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }

      const payload = sendDirectBodySchema.parse(request.body);
      const result = await socialRepository.sendWhisper(
        actor,
        payload.targetCharacterName,
        payload.body,
      );

      response.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      if (isErrorCode(error, "target_not_found")) {
        response.status(404).json({
          error: "target_not_found",
          message: "Target character not found.",
        });
        return;
      }

      if (isErrorCode(error, "cannot_whisper_self")) {
        response.status(400).json({
          error: "cannot_whisper_self",
          message: "Cannot whisper yourself.",
        });
        return;
      }

      if (isErrorCode(error, "direct_blocked")) {
        response.status(403).json({
          error: "direct_blocked",
          message: "Direct message blocked.",
        });
        return;
      }

      next(error);
    }
  });

  router.get("/chat/direct", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);

      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }

      const conversations = await socialRepository.listDirectConversations(actor);
      response.json({
        conversations,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/chat/direct/:conversationId/messages",
    enforceReadRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const limit = limitSchema.parse(request.query["limit"]) ?? 50;
        const after =
          typeof request.query["after"] === "string" ? request.query["after"] : undefined;
        const entries = await socialRepository.listDirectMessages(
          actor,
          routeParam(request.params["conversationId"]),
          after,
          limit,
        );

        response.json({
          count: entries.length,
          entries,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "forbidden")) {
          response.status(403).json({
            error: "forbidden",
            message: "Conversation access denied.",
          });
          return;
        }

        if (isErrorCode(error, "conversation_not_found")) {
          response.status(404).json({
            error: "conversation_not_found",
            message: "Conversation not found.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.post("/social/friends/add", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);

      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }

      const payload = friendAddBodySchema.parse(request.body);
      await socialRepository.addFriend(actor, payload.target);
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      if (isErrorCode(error, "target_not_found")) {
        response.status(404).json({
          error: "target_not_found",
          message: "Target not found.",
        });
        return;
      }

      if (isErrorCode(error, "cannot_target_self")) {
        response.status(400).json({
          error: "cannot_target_self",
          message: "Cannot target self.",
        });
        return;
      }

      next(error);
    }
  });

  router.post(
    "/social/blocks/:targetProfileId",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const targetProfileId = z.string().uuid().parse(request.params["targetProfileId"]);
        await socialRepository.setBlock(actor, targetProfileId, true);
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "cannot_target_self")) {
          response.status(400).json({
            error: "cannot_target_self",
            message: "Cannot target self.",
          });
          return;
        }

        next(error);
      }
    },
  );

  router.delete(
    "/social/blocks/:targetProfileId",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(401).json({
            error: "unauthenticated",
            message: "Authentication required.",
          });
          return;
        }

        const targetProfileId = z.string().uuid().parse(request.params["targetProfileId"]);
        await socialRepository.setBlock(actor, targetProfileId, false);
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        next(error);
      }
    },
  );

  router.get("/social/players", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);

      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }

      const page = z.coerce.number().int().min(1).parse(request.query["page"] ?? 1);
      const pageSize = z.coerce.number().int().min(1).max(100).parse(request.query["pageSize"] ?? 50);
      const search =
        typeof request.query["search"] === "string" ? request.query["search"] : undefined;
      const result = await socialRepository.listPlayers(actor, {
        search,
        page,
        pageSize,
      });

      response.json({
        page,
        pageSize,
        total: result.total,
        entries: result.entries,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      next(error);
    }
  });

  router.get(
    "/social/admin/players",
    enforceReadRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }

        const page = z.coerce.number().int().min(1).parse(request.query["page"] ?? 1);
        const pageSize = z.coerce.number().int().min(1).max(100).parse(request.query["pageSize"] ?? 50);
        const search =
          typeof request.query["search"] === "string" ? request.query["search"] : undefined;
        const result = await socialRepository.listAdminPlayers({
          page,
          pageSize,
          search,
        });
        response.json({
          page,
          pageSize,
          total: result.total,
          entries: result.entries,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        next(error);
      }
    },
  );

  router.get(
    "/social/admin/profile/:profileId",
    enforceReadRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }

        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const overview = await socialRepository.getAdminProfileDetail(profileId);

        if (!overview) {
          response.status(404).json({
            error: "profile_not_found",
            message: "Profile not found.",
          });
          return;
        }

        response.json(overview);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        next(error);
      }
    },
  );

  router.get("/admin/permissions", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

      if (!actor) {
        response.status(403).json({
          error: "forbidden",
          message: "Admin rank is required.",
        });
        return;
      }

      response.json({
        permissions: socialRepository.getGrantablePermissions(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/admin/profiles/:profileId/permissions",
    enforceReadRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }

        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const permissions = await socialRepository.getProfilePermissions(profileId);
        response.json({ permissions });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/admin/profiles/:profileId/permissions",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }

        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const payload = adminPermissionBodySchema.parse(request.body);
        await socialRepository.grantProfilePermission(
          actor.profileId,
          profileId,
          payload.permissionId,
        );
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }

        if (isErrorCode(error, "permission_not_grantable")) {
          response.status(400).json({
            error: "permission_not_grantable",
            message: "Permission is not in the safe grantable set.",
          });
          return;
        }
        next(error);
      }
    },
  );

  router.delete(
    "/admin/profiles/:profileId/permissions/:permissionId",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }

        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const permissionId = z.string().trim().min(1).max(120).parse(request.params["permissionId"]);
        await socialRepository.revokeProfilePermission(actor.profileId, profileId, permissionId);
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/admin/profiles/:profileId/kick",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withAdminModerationAction(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        "kick",
      );
    },
  );

  router.post(
    "/admin/profiles/:profileId/ban",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withAdminModerationAction(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        "ban",
      );
    },
  );

  router.post(
    "/admin/profiles/:profileId/mute",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withAdminModerationAction(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        "mute",
      );
    },
  );

  router.post(
    "/admin/profiles/:profileId/warn",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withAdminModerationAction(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        "warn",
      );
    },
  );

  router.post(
    "/admin/profiles/:profileId/unban",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withAdminModerationClear(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        "ban",
      );
    },
  );

  router.post(
    "/admin/profiles/:profileId/unmute",
    enforceWriteRateLimit,
    async (request, response, next) => {
      await withAdminModerationClear(
        request,
        response,
        next,
        socialRepository,
        multiplayerRepository,
        "mute",
      );
    },
  );

  router.get(
    "/admin/profiles/:profileId/notes",
    enforceReadRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);
        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }
        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const notes = await socialRepository.listAdminNotes(profileId);
        response.json({ notes });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/admin/profiles/:profileId/notes",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);
        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }
        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const payload = adminNoteBodySchema.parse(request.body);
        const note = await socialRepository.addAdminNote(actor.profileId, profileId, payload.body);
        response.status(201).json({ note });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        if (isErrorCode(error, "invalid_note")) {
          response.status(400).json({
            error: "invalid_note",
            message: "Note body cannot be empty.",
          });
          return;
        }
        next(error);
      }
    },
  );

  router.put(
    "/admin/profiles/:profileId/notes/:noteId",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);
        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }
        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const noteId = z.string().uuid().parse(request.params["noteId"]);
        const payload = adminNoteBodySchema.parse(request.body);
        const note = await socialRepository.updateAdminNote(actor.profileId, profileId, noteId, payload.body);
        response.json({ note });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        if (isErrorCode(error, "invalid_note")) {
          response.status(400).json({
            error: "invalid_note",
            message: "Note body cannot be empty.",
          });
          return;
        }
        next(error);
      }
    },
  );

  router.delete(
    "/admin/profiles/:profileId/notes/:noteId",
    enforceWriteRateLimit,
    async (request, response, next) => {
      try {
        const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);
        if (!actor) {
          response.status(403).json({
            error: "forbidden",
            message: "Admin rank is required.",
          });
          return;
        }
        const profileId = z.string().uuid().parse(request.params["profileId"]);
        const noteId = z.string().uuid().parse(request.params["noteId"]);
        await socialRepository.deleteAdminNote(actor.profileId, profileId, noteId);
        response.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: "invalid_request",
            message: error.issues.map((issue) => issue.message).join("; "),
          });
          return;
        }
        next(error);
      }
    },
  );

  router.get("/admin/audit-log", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(403).json({
          error: "forbidden",
          message: "Admin rank is required.",
        });
        return;
      }
      const page = z.coerce.number().int().min(1).parse(request.query["page"] ?? 1);
      const pageSize = z.coerce.number().int().min(1).max(100).parse(request.query["pageSize"] ?? 50);
      const targetProfileId = typeof request.query["targetProfileId"] === "string"
        ? z.string().uuid().parse(request.query["targetProfileId"])
        : undefined;
      const result = await socialRepository.listAdminAuditLog({
        page,
        pageSize,
        targetProfileId,
      });
      response.json({
        page,
        pageSize,
        total: result.total,
        entries: result.entries,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.get("/social/friends", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const friendships = await socialRepository.listFriendships(actor.profileId);
      response.json({ friendships });
    } catch (error) {
      next(error);
    }
  });

  router.post("/social/friends/character", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const payload = friendCharacterBodySchema.parse(request.body);
      await socialRepository.createCharacterFriendship({
        requesterProfileId: actor.profileId,
        requesterCharacterId: actor.characterId,
        targetProfileId: payload.targetProfileId,
        targetCharacterId: payload.targetCharacterId,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.post("/social/friends/profile-request", enforceFriendRequestLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const payload = friendProfileRequestBodySchema.parse(request.body);
      await socialRepository.createProfileFriendRequest({
        requesterProfileId: actor.profileId,
        targetProfileId: payload.targetProfileId,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "friend_request_blocked")) {
        response.status(403).json({
          error: "friend_request_blocked",
          message: "Friend request blocked by privacy or block list.",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/social/friends/:friendshipId/accept", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const friendshipId = z.string().uuid().parse(request.params["friendshipId"]);
      await socialRepository.respondProfileFriendRequest({
        actorProfileId: actor.profileId,
        friendshipId,
        accept: true,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "friendship_not_found")) {
        response.status(404).json({
          error: "friendship_not_found",
          message: "Friend request not found.",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/social/friends/:friendshipId/reject", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const friendshipId = z.string().uuid().parse(request.params["friendshipId"]);
      await socialRepository.respondProfileFriendRequest({
        actorProfileId: actor.profileId,
        friendshipId,
        accept: false,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "friendship_not_found")) {
        response.status(404).json({
          error: "friendship_not_found",
          message: "Friend request not found.",
        });
        return;
      }
      next(error);
    }
  });

  router.delete("/social/friends/:friendshipId", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const friendshipId = z.string().uuid().parse(request.params["friendshipId"]);
      await socialRepository.removeFriendship(actor.profileId, friendshipId);
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.get("/social/blocks", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const blocks = await socialRepository.listBlockedProfiles(actor.profileId);
      response.json({ blocks });
    } catch (error) {
      next(error);
    }
  });

  router.post("/social/blocks", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const payload = socialBlockBodySchema.parse(request.body);
      await socialRepository.setBlockedProfile({
        blockerProfileId: actor.profileId,
        blockedProfileId: payload.blockedProfileId,
        reason: payload.reason,
        blocked: true,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.delete("/social/blocks/:blockedProfileId", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const blockedProfileId = z.string().uuid().parse(request.params["blockedProfileId"]);
      await socialRepository.setBlockedProfile({
        blockerProfileId: actor.profileId,
        blockedProfileId,
        blocked: false,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.get("/social/privacy", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const settings = await socialRepository.getPrivacySettings(actor.profileId);
      response.json(settings);
    } catch (error) {
      next(error);
    }
  });

  router.put("/social/privacy", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const payload = privacySettingsBodySchema.parse(request.body);
      await socialRepository.updatePrivacySettings({
        profileId: actor.profileId,
        ...payload,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.post("/social/reports", enforceReportLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const payload = reportBodySchema.parse(request.body);
      const report = await socialRepository.createPlayerReport({
        reporterProfileId: actor.profileId,
        targetProfileId: payload.targetProfileId,
        targetMessageId: payload.targetMessageId,
        reason: payload.reason,
      });
      response.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.get("/guilds/current", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const guild = await socialRepository.getCurrentGuild(actor.characterId);
      response.json({ guild });
    } catch (error) {
      next(error);
    }
  });

  router.get("/guilds/invitations", enforceReadRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const invitations = await socialRepository.listPendingGuildInvitations(actor.profileId);
      response.json({ invitations });
    } catch (error) {
      next(error);
    }
  });

  router.post("/guilds", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const payload = guildCreateBodySchema.parse(request.body);
      const guild = await socialRepository.createGuild({
        actorProfileId: actor.profileId,
        actorCharacterId: actor.characterId,
        name: payload.name,
      });
      response.status(201).json({ guild });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "guild_already_joined")) {
        response.status(409).json({
          error: "guild_already_joined",
          message: "Current character is already in a guild.",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/guilds/:guildId/invite", enforceGuildInviteLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const guildId = z.string().uuid().parse(request.params["guildId"]);
      const payload = guildInviteBodySchema.parse(request.body);
      const invitation = await socialRepository.inviteToGuild({
        guildId,
        inviterProfileId: actor.profileId,
        inviterCharacterId: actor.characterId,
        targetProfileId: payload.targetProfileId,
        targetCharacterId: payload.targetCharacterId,
      });
      response.status(201).json(invitation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "guild_invite_forbidden")) {
        response.status(403).json({
          error: "guild_invite_forbidden",
          message: "Guild master or officer role is required to invite.",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/guilds/invitations/:invitationId/accept", enforceWriteRateLimit, async (request, response, next) => {
    await withGuildInvitationResponse(
      request,
      response,
      next,
      socialRepository,
      multiplayerRepository,
      true,
    );
  });

  router.post("/guilds/invitations/:invitationId/reject", enforceWriteRateLimit, async (request, response, next) => {
    await withGuildInvitationResponse(
      request,
      response,
      next,
      socialRepository,
      multiplayerRepository,
      false,
    );
  });

  router.post("/guilds/:guildId/members/:characterId/role", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const guildId = z.string().uuid().parse(request.params["guildId"]);
      const characterId = z.string().uuid().parse(request.params["characterId"]);
      const payload = guildRoleBodySchema.parse(request.body);
      const actorGuild = await socialRepository.getCurrentGuild(actor.characterId);
      if (!actorGuild || actorGuild.guildId !== guildId) {
        response.status(403).json({
          error: "guild_role_forbidden",
          message: "Only guild master can change guild member roles.",
        });
        return;
      }
      await socialRepository.setGuildMemberRole({
        guildId,
        actorCharacterId: actor.characterId,
        characterId,
        role: payload.role,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "guild_role_forbidden")) {
        response.status(403).json({
          error: "guild_role_forbidden",
          message: "Only guild master can change guild member roles.",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/guilds/:guildId/members/:characterId/kick", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const guildId = z.string().uuid().parse(request.params["guildId"]);
      const characterId = z.string().uuid().parse(request.params["characterId"]);
      const actorGuild = await socialRepository.getCurrentGuild(actor.characterId);
      if (!actorGuild || actorGuild.guildId !== guildId) {
        response.status(403).json({
          error: "guild_kick_forbidden",
          message: "Guild master or officer role is required to kick.",
        });
        return;
      }
      await socialRepository.kickGuildMember({
        guildId,
        actorCharacterId: actor.characterId,
        characterId,
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      if (isErrorCode(error, "guild_kick_forbidden")) {
        response.status(403).json({
          error: "guild_kick_forbidden",
          message: "Guild master or officer role is required to kick.",
        });
        return;
      }
      if (isErrorCode(error, "cannot_target_self")) {
        response.status(400).json({
          error: "cannot_target_self",
          message: "Cannot target self.",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/guilds/:guildId/leave", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const actor = await requireActor(request, socialRepository, multiplayerRepository);
      if (!actor) {
        response.status(401).json({
          error: "unauthenticated",
          message: "Authentication required.",
        });
        return;
      }
      const guildId = z.string().uuid().parse(request.params["guildId"]);
      await socialRepository.leaveGuild({ guildId, characterId: actor.characterId });
      response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "invalid_request",
          message: error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }
      next(error);
    }
  });

  router.get("/server/motd", enforceReadRateLimit, async (_request, response) => {
    response.json({
      motd: config.motd ?? "Welcome to Kairos.",
    });
  });

  return router;
}

async function withChannelModerationAction(
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
  ban: boolean,
): Promise<void> {
  try {
    const actor = await requireActor(request, socialRepository, multiplayerRepository);

    if (!actor) {
      response.status(401).json({
        error: "unauthenticated",
        message: "Authentication required.",
      });
      return;
    }

    const payload = profileTargetBodySchema.parse(request.body);
    await socialRepository.kickMember(
      actor,
      routeParam(request.params["channelId"]),
      payload.targetProfileId,
      ban,
    );
    response.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "invalid_request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }

    if (isErrorCode(error, "forbidden")) {
      response.status(403).json({
        error: "forbidden",
        message: "Only the channel owner can do that.",
      });
      return;
    }

    if (isErrorCode(error, "cannot_target_self")) {
      response.status(400).json({
        error: "cannot_target_self",
        message: "Cannot target self.",
      });
      return;
    }

    if (isErrorCode(error, "channel_not_found")) {
      response.status(404).json({
        error: "channel_not_found",
        message: "Channel not found.",
      });
      return;
    }

    next(error);
  }
}

async function withAdminModerationAction(
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
  type: "kick" | "ban" | "mute" | "warn",
): Promise<void> {
  try {
    const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

    if (!actor) {
      response.status(403).json({
        error: "forbidden",
        message: "Admin rank is required.",
      });
      return;
    }

    const profileId = z.string().uuid().parse(request.params["profileId"]);
    const payload = adminActionBodySchema.parse(request.body ?? {});
    await socialRepository.applyProfileModerationAction({
      actorProfileId: actor.profileId,
      targetProfileId: profileId,
      type,
      reason: payload.reason,
      expiresAt: payload.expiresAt,
    });
    response.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "invalid_request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    next(error);
  }
}

async function withAdminModerationClear(
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
  type: "ban" | "mute",
): Promise<void> {
  try {
    const actor = await requireAdminActor(request, socialRepository, multiplayerRepository);

    if (!actor) {
      response.status(403).json({
        error: "forbidden",
        message: "Admin rank is required.",
      });
      return;
    }

    const profileId = z.string().uuid().parse(request.params["profileId"]);
    const payload = adminActionBodySchema.parse(request.body ?? {});
    await socialRepository.clearProfileModerationAction({
      actorProfileId: actor.profileId,
      targetProfileId: profileId,
      type,
      reason: payload.reason,
    });
    response.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "invalid_request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    next(error);
  }
}

async function withGuildInvitationResponse(
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
  accept: boolean,
): Promise<void> {
  try {
    const actor = await requireActor(request, socialRepository, multiplayerRepository);

    if (!actor) {
      response.status(401).json({
        error: "unauthenticated",
        message: "Authentication required.",
      });
      return;
    }

    const invitationId = z.string().uuid().parse(request.params["invitationId"]);
    await socialRepository.respondGuildInvitation({
      actorProfileId: actor.profileId,
      invitationId,
      accept,
    });
    response.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "invalid_request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    if (isErrorCode(error, "invitation_not_found")) {
      response.status(404).json({
        error: "invitation_not_found",
        message: "Invitation not found.",
      });
      return;
    }
    next(error);
  }
}

async function requireActor(
  request: import("express").Request,
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
) {
  const sessionId = extractSessionId(request);

  if (!sessionId) {
    return null;
  }

  const session = await multiplayerRepository.getSession(sessionId);

  if (!session) {
    return null;
  }

  return socialRepository.resolveActorBySession(sessionId);
}

async function requireAdminActor(
  request: import("express").Request,
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
) {
  const actor = await requireActor(request, socialRepository, multiplayerRepository);

  if (!actor) {
    return null;
  }

  if (actor.rank === "admin") {
    return actor;
  }

  if (await socialRepository.hasProfilePermission(actor.profileId, "admin_panel")) {
    return actor;
  }

  return null;
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function tryHandleSlashCommand(
  socialRepository: SocialRepository,
  actor: NonNullable<Awaited<ReturnType<typeof requireActor>>>,
  rawBody: string,
): Promise<{ handled: true; statusCode: number; body: unknown } | { handled: false }> {
  const body = rawBody.trim();

  if (!body.startsWith("/")) {
    return { handled: false };
  }

  const tokens = tokenize(body);

  if (tokens.length === 0) {
    return { handled: false };
  }

  const command = tokens[0]?.toLowerCase();

  if (command === "/join") {
    const name = tokens[1] ?? "";
    const result = await socialRepository.joinCustomChannel(actor, name);
    return {
      handled: true,
      statusCode: result.created ? 201 : 200,
      body: result,
    };
  }

  if (command === "/leave") {
    const name = tokens[1] ?? "";

    if (!name) {
      throw new Error("unknown_command");
    }

    const channels = await socialRepository.listChannelsForActor(actor);
    const target = channels.find(
      (channel) =>
        channel.type === "custom" && channel.name.toLowerCase() === name.toLowerCase(),
    );

    if (!target) {
      throw new Error("channel_not_found");
    }

    await socialRepository.leaveCustomChannel(actor, target.id);
    return {
      handled: true,
      statusCode: 200,
      body: { ok: true },
    };
  }

  if (command === "/w" || command === "/whisper" || command === "/tell") {
    const targetCharacterName = tokens[1] ?? "";
    const message = tokens.slice(2).join(" ").trim();

    if (!targetCharacterName || !message) {
      throw new Error("unknown_command");
    }

    const result = await socialRepository.sendWhisper(actor, targetCharacterName, message);
    return {
      handled: true,
      statusCode: 201,
      body: result,
    };
  }

  if (command === "/friend" && tokens[1]?.toLowerCase() === "add") {
    const target = tokens.slice(2).join(" ").trim();

    if (!target) {
      throw new Error("unknown_command");
    }

    await socialRepository.addFriend(actor, target);
    return {
      handled: true,
      statusCode: 200,
      body: { ok: true },
    };
  }

  if (command === "/guild" && tokens[1]?.toLowerCase() === "invite") {
    return {
      handled: true,
      statusCode: 200,
      body: {
        ok: false,
        message: "Guild invite endpoint is not yet connected to a guild system.",
      },
    };
  }

  throw new Error("unknown_command");
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  let match = pattern.exec(input);

  while (match) {
    const quoted = match[1]?.trim();
    const plain = match[2]?.trim();

    if (quoted) {
      tokens.push(quoted);
    } else if (plain) {
      tokens.push(plain);
    }

    match = pattern.exec(input);
  }

  return tokens;
}
