import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import type { ServerConfig } from "../config";
import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import type { PlayerProfileRepository } from "./player-profile-repository";
import type { CharacterContentBinding, PlayerProfileSummary } from "./player-profile-types";
import { extractSessionId } from "../auth/session-auth";
import { buildServerProfile } from "../server-profile/server-profile-service";
import { validateServerProfileToken } from "../server-profile/server-profile-token";
import type { SocialRepository } from "../social/social-repository";

const characterNameSchema = z.string().trim().min(1).max(80);
const contentBindingSchema = z.object({
  serverName: z.string().trim().min(1).max(200),
  customContent: z.boolean(),
  profileToken: z.string().min(1).max(2000),
});
const characterSnapshotSchema = z.object({
  portraitShardId: z.string().trim().min(1).max(200).optional(),
  level: z.number().int().min(1).optional(),
  locationId: z.string().trim().min(1).max(200).optional(),
  lastLocationName: z.string().trim().min(1).max(200).optional(),
});
const createCharacterBodySchema = z.object({
  name: characterNameSchema,
  contentBinding: contentBindingSchema.optional(),
  initialSnapshot: characterSnapshotSchema.optional(),
});
const registerCharacterBodySchema = z.object({
  characterId: z.string().trim().uuid(),
  characterName: characterNameSchema,
  portraitShardId: z.string().trim().min(1).max(200),
  level: z.number().int().min(1).optional(),
  locationId: z.string().trim().min(1).max(200).optional(),
  lastLocationName: z.string().trim().min(1).max(200).optional(),
});
const registerActiveCharacterBodySchema = z.object({
  characterId: z.string().trim().uuid(),
  level: z.number().int().min(1).optional(),
  locationId: z.string().trim().min(1).max(200).optional(),
  lastLocationName: z.string().trim().min(1).max(200).optional(),
});
const selectCharacterBodySchema = z.object({
  snapshot: characterSnapshotSchema.optional(),
});
const patchProfileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export function createPlayerProfileRouter(
  repository: PlayerProfileRepository,
  multiplayerRepository: MultiplayerRepository,
  config: ServerConfig,
  socialRepository?: SocialRepository,
): Router {
  const router = Router();

  // 30 profile reads per minute — profile page, character list
  const enforceReadRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many profile requests. Try again in a minute.",
    },
  });

  // 10 write operations per minute — character creation, selection
  const enforceWriteRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many write requests. Try again in a minute.",
    },
  });

  /**
   * GET /api/player/profile
   * Returns the authenticated player's profile and characters.
   * Requires a valid session.
   */
  router.get("/profile", enforceReadRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to access your profile.",
        });
        return;
      }

      // Ensure a profile row exists (upsert on first access).
      await repository.upsertProfile(session.profileId);
      const summary = await repository.getProfileSummary(session.profileId);

      if (!summary) {
        response.status(404).json({
          error: "profile_not_found",
          message: "Player profile could not be found.",
        });
        return;
      }

      response.json(await buildProfileResponse(summary, session, socialRepository));
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/player/profile
   * Update the authenticated player's profile display name and return the full profile summary.
   */
  router.patch("/profile", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to update your profile.",
        });
        return;
      }

      const parseResult = patchProfileBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        response.status(400).json({
          error: "invalid_request",
          message: parseResult.error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      await repository.upsertProfile(session.profileId);
      await repository.updateProfileDisplayName(session.profileId, parseResult.data.displayName);

      if (socialRepository) {
        await socialRepository.refreshPresenceFromSessions();
      }

      const summary = await repository.getProfileSummary(session.profileId);

      if (!summary) {
        response.status(404).json({
          error: "profile_not_found",
          message: "Player profile could not be found.",
        });
        return;
      }

      response.json(await buildProfileResponse(summary, session, socialRepository));
    } catch (error) {
      next(error);
    }
  });

  router.post("/register-character", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to register a character.",
        });
        return;
      }

      const parseResult = registerCharacterBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        response.status(400).json({
          error: "invalid_request",
          message: parseResult.error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      const currentProfile = buildServerProfile(config);
      const registered = await repository.registerCharacter(
        session.profileId,
        parseResult.data,
        {
          serverName: currentProfile.serverName,
          customContent: currentProfile.customContent,
          profileToken: currentProfile.profileToken,
          acceptedAt: new Date().toISOString(),
        },
      );

      response.status(registered.status === "created" ? 201 : 200).json({
        status: registered.status,
        character: toCharacterSummary(registered.character),
      });
    } catch (error) {
      if (isErrorCode(error, "character_profile_conflict")) {
        response.status(409).json({
          error: "character_profile_conflict",
          message: "This character is already registered to a different profile on this server.",
        });
        return;
      }

      if (isErrorCode(error, "character_tamper_detected")) {
        response.status(409).json({
          error: "character_tamper_detected",
          message: "This character's data could not be verified on this server.",
        });
        return;
      }

      next(error);
    }
  });

  router.post("/register-active-character", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to activate a character.",
        });
        return;
      }

      const parseResult = registerActiveCharacterBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        response.status(400).json({
          error: "invalid_request",
          message: parseResult.error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      const character = await repository.getCharacter(parseResult.data.characterId);

      if (!character || character.profileId !== session.profileId) {
        response.status(404).json({
          error: "character_not_registered",
          message: "This character is not registered on the current server for your profile.",
        });
        return;
      }

      const currentProfile = buildServerProfile(config);
      const compatibilityResult = checkCharacterCompatibility(
        character.contentBinding ?? null,
        currentProfile.profileToken,
        currentProfile.customContent,
        config.clientSecret,
      );

      if (!compatibilityResult.compatible) {
        response.status(409).json({
          error: "character_incompatible",
          message: compatibilityResult.reason,
        });
        return;
      }

      const updated = await repository.registerActiveCharacter(
        session.profileId,
        parseResult.data.characterId,
        {
          level: parseResult.data.level,
          locationId: parseResult.data.locationId,
          lastLocationName: parseResult.data.lastLocationName,
        },
      );
      await multiplayerRepository.setActiveCharacter(
        session.sessionId,
        session.profileId,
        parseResult.data.characterId,
      );

      if (socialRepository) {
        await socialRepository.refreshPresenceFromSessions();
      }

      response.json({
        status: "activated",
        profileId: session.profileId,
        activeCharacterId: parseResult.data.characterId,
        character: toCharacterSummary(updated),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/characters/:characterId", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to remove a character.",
        });
        return;
      }

      const { characterId } = request.params;
      const characterIdStr = Array.isArray(characterId) ? characterId[0] : characterId;

      if (!characterIdStr) {
        response.status(400).json({
          error: "invalid_request",
          message: "Character ID is required.",
        });
        return;
      }

      if (session.activeCharacterId === characterIdStr) {
        response.status(409).json({
          error: "active_character_delete_blocked",
          message: "Switch to a different character before removing this one from the server profile.",
        });
        return;
      }

      const deleted = await repository.deleteCharacter(session.profileId, characterIdStr);

      if (!deleted) {
        response.status(404).json({
          error: "character_not_found",
          message: "Character not found in your current server profile.",
        });
        return;
      }

      if (socialRepository) {
        await socialRepository.refreshPresenceFromSessions();
      }

      response.json({
        deleted: true,
        characterId: characterIdStr,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/player/characters
   * Create a new character under the authenticated player's profile.
   * Validates the submitted content binding against the current server profile.
   */
  router.post("/characters", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to create a character.",
        });
        return;
      }

      const parseResult = createCharacterBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        response.status(400).json({
          error: "invalid_request",
          message: parseResult.error.issues.map((i) => i.message).join("; "),
        });
        return;
      }

      const {
        name,
        contentBinding: submittedBinding,
        initialSnapshot,
      } = parseResult.data;

      // Validate submitted content binding against current server profile.
      let resolvedBinding: CharacterContentBinding | null = null;

      if (submittedBinding) {
        const validationResult = validateServerProfileToken(
          submittedBinding.profileToken,
          config.clientSecret,
        );

        if (!validationResult.valid) {
          response.status(400).json({
            error: "invalid_content_binding",
            message: `Content binding token is invalid: ${validationResult.error ?? "Validation failed."}`,
          });
          return;
        }

        resolvedBinding = {
          serverName: submittedBinding.serverName,
          customContent: submittedBinding.customContent,
          profileToken: submittedBinding.profileToken,
          acceptedAt: new Date().toISOString(),
        };
      } else {
        // No binding submitted — bind to current server profile automatically.
        const currentProfile = buildServerProfile(config);
        resolvedBinding = {
          serverName: currentProfile.serverName,
          customContent: currentProfile.customContent,
          profileToken: currentProfile.profileToken,
          acceptedAt: new Date().toISOString(),
        };
      }

      // Ensure profile exists.
      await repository.upsertProfile(session.profileId);

      const character = await repository.createCharacter(
        session.profileId,
        name,
        resolvedBinding,
        initialSnapshot,
      );

      response.status(201).json(character);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/player/characters/:characterId/select
   * Select (load) a character, enforcing content compatibility.
   * The character must belong to the authenticated player's profile.
   * Custom-content characters must have a token matching the current server profile.
   */
  router.post("/characters/:characterId/select", enforceWriteRateLimit, async (request, response, next) => {
    try {
      const session = await resolveAuthenticatedProfileSession(request, multiplayerRepository);

      if (!session) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to select a character.",
        });
        return;
      }

      const { characterId } = request.params;
      const characterIdStr = Array.isArray(characterId) ? characterId[0] : characterId;
      const bodyParseResult = selectCharacterBodySchema.safeParse(request.body ?? {});

      if (!bodyParseResult.success) {
        response.status(400).json({
          error: "invalid_request",
          message: bodyParseResult.error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      if (!characterIdStr) {
        response.status(400).json({
          error: "invalid_request",
          message: "Character ID is required.",
        });
        return;
      }

      const character = await repository.getCharacter(characterIdStr);

      if (!character) {
        response.status(404).json({
          error: "character_not_found",
          message: "Character not found.",
        });
        return;
      }

      // Ensure the character belongs to the authenticated player.
      if (character.profileId !== session.profileId) {
        response.status(403).json({
          error: "character_access_denied",
          message: "You do not have access to this character.",
        });
        return;
      }

      const currentProfile = buildServerProfile(config);

      // Enforce content compatibility.
      const compatibilityResult = checkCharacterCompatibility(
        character.contentBinding ?? null,
        currentProfile.profileToken,
        currentProfile.customContent,
        config.clientSecret,
      );

      if (!compatibilityResult.compatible) {
        response.status(409).json({
          error: "character_incompatible",
          message: compatibilityResult.reason,
        });
        return;
      }

      // If the character has no binding, bind it to the current server on first connect.
      if (!character.contentBinding) {
        await repository.updateCharacterBinding(characterIdStr, {
          serverName: currentProfile.serverName,
          customContent: currentProfile.customContent,
          profileToken: currentProfile.profileToken,
          acceptedAt: new Date().toISOString(),
        });
      }

      if (bodyParseResult.data.snapshot) {
        await repository.updateCharacterSnapshot(characterIdStr, bodyParseResult.data.snapshot);
      }

      await repository.markCharacterSelected(characterIdStr);
      await multiplayerRepository.setActiveCharacter(
        session.sessionId,
        session.profileId,
        characterIdStr,
      );
      if (socialRepository) {
        await socialRepository.refreshPresenceFromSessions();
      }
      const updatedCharacter = await repository.getCharacter(characterIdStr);

      response.json({
        selected: true,
        profileId: session.profileId,
        activeCharacterId: characterIdStr,
        character: updatedCharacter,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reason: string;
}

/**
 * Check whether a character can be loaded into the current server.
 *
 * Rules:
 * - No binding: allow (will be bound on first connect).
 * - Server is non-custom (customContent=false): allow unmodded-compatible characters.
 * - Server is custom (customContent=true): character binding token must match current server token.
 *
 * NOTE: Token comparison uses strict equality of the profileToken string, which means
 * if the server's token changes (e.g. secret rotation), characters will need re-binding.
 * Additionally, different custom servers with the same serverName and secret could appear
 * compatible — this is an accepted limitation of the first-version token design and is
 * documented in the server compatibility token spec.
 */
function checkCharacterCompatibility(
  binding: CharacterContentBinding | null,
  currentProfileToken: string,
  serverCustomContent: boolean,
  clientSecret: string,
): CompatibilityResult {
  if (!binding) {
    // No binding — allow, will be bound on first connect.
    return { compatible: true, reason: "No prior binding; will be set on connect." };
  }

  if (!serverCustomContent) {
    // Non-custom server allows any unmodded-compatible character.
    if (!binding.customContent) {
      return { compatible: true, reason: "Official server; unmodded character is compatible." };
    }

    // A custom-content character on an official server is not compatible.
    return {
      compatible: false,
      reason: `This character is bound to a custom-content server ("${binding.serverName}") and cannot be loaded on an official server.`,
    };
  }

  // Custom server — the binding token must match the current server profile token.
  if (binding.profileToken !== currentProfileToken) {
    // Also validate the current token itself to rule out a corrupted server config.
    const validationResult = validateServerProfileToken(currentProfileToken, clientSecret);

    if (!validationResult.valid) {
      return {
        compatible: false,
        reason: "Server compatibility token is invalid. Contact the server administrator.",
      };
    }

    return {
      compatible: false,
      reason: `This character's server compatibility token does not match the current server profile. The character may have been created on a different server.`,
    };
  }

  return { compatible: true, reason: "Token match; character is compatible." };
}

async function resolveAuthenticatedProfileSession(
  request: import("express").Request,
  multiplayerRepository: MultiplayerRepository,
): Promise<{
  sessionId: string;
  profileId: string;
  activeCharacterId?: string;
} | null> {
  const sessionId = extractSessionId(request);

  if (!sessionId) {
    return null;
  }

  const session = await multiplayerRepository.getSession(sessionId);

  if (!session) {
    return null;
  }

  const player = await multiplayerRepository.getAllowedPlayer(session.profileId);

  if (!player || player.serverBanned) {
    return null;
  }

  return {
    sessionId: session.sessionId,
    profileId: session.profileId,
    activeCharacterId: session.activeCharacterId,
  };
}

async function buildProfileResponse(
  summary: PlayerProfileSummary,
  session: {
    activeCharacterId?: string;
  },
  socialRepository?: SocialRepository,
): Promise<{
  id: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  characters: PlayerProfileSummary["characters"];
  profileId: string;
  activeCharacterId?: string;
  currentCharacterId?: string;
  currentCharacterName?: string;
  badges: readonly {
    type: "friend" | "guild_role" | "admin" | "moderation" | "permission";
    label: string;
  }[];
  friendSummary: {
    count: number;
  };
  guildSummary: {
    id: string;
    name: string;
    role: string;
  } | null;
}> {
  const socialSummary = socialRepository
    ? await socialRepository.getProfileSummary(summary.id)
    : null;

  return {
    ...summary,
    profileId: summary.id,
    activeCharacterId: session.activeCharacterId,
    currentCharacterId: socialSummary?.currentCharacterId,
    currentCharacterName: socialSummary?.currentCharacterName,
    badges: socialSummary?.badges ?? [],
    friendSummary: {
      count: socialSummary?.friendCount ?? 0,
    },
    guildSummary: socialSummary?.guild
      ? {
          id: socialSummary.guild.id,
          name: socialSummary.guild.name,
          role: socialSummary.guild.role,
        }
      : null,
  };
}

function toCharacterSummary(character: import("./player-profile-types").PlayerCharacterRecord): PlayerProfileSummary["characters"][number] {
  return {
    id: character.id,
    profileId: character.profileId,
    name: character.name,
    portraitShardId: character.portraitShardId,
    level: character.level,
    locationId: character.locationId,
    lastLocationName: character.lastLocationName,
    online: character.online,
    lastPlayedAt: character.lastPlayedAt,
    contentBinding: character.contentBinding,
    guildId: character.guildId,
    guildName: character.guildName,
  };
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}
