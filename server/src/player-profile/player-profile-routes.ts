import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import type { ServerConfig } from "../config";
import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import type { PlayerProfileRepository } from "./player-profile-repository";
import type { CharacterContentBinding } from "./player-profile-types";
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
const createCharacterBodySchema = z.object({
  name: characterNameSchema,
  contentBinding: contentBindingSchema.optional(),
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
      const playerUuid = await resolveAuthenticatedPlayerUuid(request, multiplayerRepository);

      if (!playerUuid) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to access your profile.",
        });
        return;
      }

      // Ensure a profile row exists (upsert on first access).
      await repository.upsertProfile(playerUuid);
      const summary = await repository.getProfileSummary(playerUuid);

      if (!summary) {
        response.status(404).json({
          error: "profile_not_found",
          message: "Player profile could not be found.",
        });
        return;
      }

      const socialSummary = socialRepository
        ? await socialRepository.getProfileSummary(playerUuid)
        : null;
      response.json({
        ...summary,
        profileId: summary.id,
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
      const playerUuid = await resolveAuthenticatedPlayerUuid(request, multiplayerRepository);

      if (!playerUuid) {
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

      const { name, contentBinding: submittedBinding } = parseResult.data;

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
      await repository.upsertProfile(playerUuid);

      const character = await repository.createCharacter(
        playerUuid,
        name,
        resolvedBinding,
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
      const playerUuid = await resolveAuthenticatedPlayerUuid(request, multiplayerRepository);

      if (!playerUuid) {
        response.status(401).json({
          error: "unauthenticated",
          message: "You must be logged in to select a character.",
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

      const character = await repository.getCharacter(characterIdStr);

      if (!character) {
        response.status(404).json({
          error: "character_not_found",
          message: "Character not found.",
        });
        return;
      }

      // Ensure the character belongs to the authenticated player.
      if (character.profileId !== playerUuid) {
        response.status(403).json({
          error: "character_access_denied",
          message: "You do not have access to this character.",
        });
        return;
      }

      const currentProfile = buildServerProfile(config);

      // Enforce content compatibility.
      const compatibilityResult = checkCharacterCompatibility(
        character.contentBinding,
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

      const updatedCharacter = await repository.getCharacter(characterIdStr);

      response.json({
        selected: true,
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

async function resolveAuthenticatedPlayerUuid(
  request: import("express").Request,
  multiplayerRepository: MultiplayerRepository,
): Promise<string | null> {
  const sessionId = extractSessionId(request);

  if (!sessionId) {
    return null;
  }

  const session = await multiplayerRepository.getSession(sessionId);

  if (!session) {
    return null;
  }

  const player = await multiplayerRepository.getAllowedPlayer(session.playerUuid);

  if (!player || player.serverBanned) {
    return null;
  }

  return player.playerUuid;
}
