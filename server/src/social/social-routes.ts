import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { extractSessionId } from "../auth/session-auth";
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

export function createSocialRouter(
  socialRepository: SocialRepository,
  multiplayerRepository: MultiplayerRepository,
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
    windowMs: 60_000,
    limit: 45,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many messages. Slow down.",
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

        await socialRepository.leaveCustomChannel(actor, request.params["channelId"] ?? "");
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
          request.params["channelId"] ?? "",
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
          request.params["channelId"] ?? "",
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
          request.params["channelId"] ?? "",
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
          request.params["channelId"] ?? "",
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
          request.params["conversationId"] ?? "",
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
      request.params["channelId"] ?? "",
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

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
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
