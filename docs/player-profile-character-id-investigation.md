# Player Profile / Character ID Investigation

Date: 2026-05-14

```ts
interface PlayerCharacterIdInvestigation {
  sameIdCurrentlyUsed: boolean;

  currentIdFields: {
    fieldName: string;
    owner: "profile" | "character" | "session" | "unknown";
    files: string[];
    usage: string;
  }[];

  uuidGeneration: {
    location: string;
    generatedFor: "profile" | "character" | "unknown";
  }[];

  persistence: {
    tableOrStorage: string;
    fieldName: string;
    likelyMeaning: "profile" | "character" | "unknown";
  }[];

  riskyReferences: {
    file: string;
    reason: string;
  }[];
}
```

```ts
export const playerCharacterIdInvestigation: PlayerCharacterIdInvestigation = {
  sameIdCurrentlyUsed: true,

  currentIdFields: [
    {
      fieldName: "allowed_players.player_uuid",
      owner: "unknown",
      files: [
        "server/src/db/database.ts",
        "server/src/multiplayer/multiplayer-repository.ts",
        "server/src/multiplayer/multiplayer-routes.ts",
      ],
      usage:
        "Acts as the login/account key today, but current connect flow sends the active character UUID here, so it behaves as a character-scoped ID in practice.",
    },
    {
      fieldName: "server_sessions.player_uuid",
      owner: "session",
      files: [
        "server/src/db/database.ts",
        "server/src/multiplayer/multiplayer-repository.ts",
        "server/src/multiplayer/multiplayer-routes.ts",
        "server/src/social/social-repository.ts",
      ],
      usage:
        "Session identity field. Social hydration reads it as a character ID first, then falls back to profile/legacy semantics when no player_characters row exists.",
    },
    {
      fieldName: "player_profiles.id",
      owner: "profile",
      files: [
        "server/src/db/database.ts",
        "server/src/player-profile/player-profile-repository.ts",
        "server/src/social/social-repository.ts",
      ],
      usage:
        "Canonical profile table key, but player-profile routes currently upsert it using the authenticated session player UUID, which is still legacy/ambiguous.",
    },
    {
      fieldName: "player_characters.id",
      owner: "character",
      files: [
        "server/src/db/database.ts",
        "server/src/player-profile/player-profile-repository.ts",
        "server/src/social/social-repository.ts",
      ],
      usage:
        "Canonical character table key. Social code already prefers this for guilds, chat sender character IDs, and presence.current_character_id.",
    },
    {
      fieldName: "player_characters.profile_id",
      owner: "profile",
      files: [
        "server/src/db/database.ts",
        "server/src/player-profile/player-profile-repository.ts",
        "server/src/social/social-repository.ts",
      ],
      usage:
        "Existing ownership edge from character to profile. This is already the correct relationship and should become the single source of truth.",
    },
    {
      fieldName: "Player.id / character local save id",
      owner: "character",
      files: [
        "core/src/core/models/player.ts",
        "game/src/app/core/services/character-roster.service.ts",
        "game/src/app/features/character-creator/character-creator-container.component.ts",
      ],
      usage:
        "Offline/local save character ID. The shell currently reuses this as the server login ID when connecting, which is the main client-side conflation.",
    },
    {
      fieldName: "currentPlayerUuid",
      owner: "session",
      files: [
        "game/src/app/core/services/server-chat.service.ts",
        "game/src/app/layout/shell/shell-container.component.ts",
        "game/src/app/shared/components/server-chat-panel/sub-pieces/server-chat-message-list.component.ts",
      ],
      usage:
        "Frontend session shorthand used for chat/presence comparisons. Today it maps to serverConnection.session().playerUuid and therefore inherits the legacy ambiguity.",
    },
    {
      fieldName: "profileId / characterId DTO fields",
      owner: "unknown",
      files: [
        "server/src/social/social-types.ts",
        "game/src/app/core/services/server-chat.models.ts",
        "server/src/player-profile/player-profile-types.ts",
      ],
      usage:
        "Newer DTOs already separate profileId and characterId, but some summaries still omit profileId on nested character records and some callers continue to treat playerUuid as the main identity.",
    },
  ],

  uuidGeneration: [
    {
      location: "server/src/player-profile/player-profile-repository.ts#createCharacter",
      generatedFor: "character",
    },
    {
      location: "server/src/multiplayer/multiplayer-repository.ts#createSession",
      generatedFor: "unknown",
    },
    {
      location: "game/src/app/core/utils/player-uuid.ts#generatePlayerUuid",
      generatedFor: "unknown",
    },
    {
      location: "game/src/app/features/character-creator/character-creator-container.component.ts",
      generatedFor: "character",
    },
    {
      location: "game/src/app/core/services/server-connection.service.ts#addServer",
      generatedFor: "unknown",
    },
  ],

  persistence: [
    {
      tableOrStorage: "allowed_players",
      fieldName: "player_uuid",
      likelyMeaning: "unknown",
    },
    {
      tableOrStorage: "server_sessions",
      fieldName: "player_uuid",
      likelyMeaning: "unknown",
    },
    {
      tableOrStorage: "player_profiles",
      fieldName: "id",
      likelyMeaning: "profile",
    },
    {
      tableOrStorage: "player_characters",
      fieldName: "id",
      likelyMeaning: "character",
    },
    {
      tableOrStorage: "player_characters",
      fieldName: "profile_id",
      likelyMeaning: "profile",
    },
    {
      tableOrStorage: "player_presence",
      fieldName: "profile_id",
      likelyMeaning: "profile",
    },
    {
      tableOrStorage: "player_presence",
      fieldName: "current_character_id",
      likelyMeaning: "character",
    },
    {
      tableOrStorage: "game localStorage grayvale:save-slots:v1",
      fieldName: "slot.player.id",
      likelyMeaning: "character",
    },
  ],

  riskyReferences: [
    {
      file: "server/src/player-profile/player-profile-routes.ts",
      reason:
        "resolveAuthenticatedPlayerUuid returns session.playerUuid and profile routes then upsert/read player_profiles with that value, which recreates the legacy profileId === characterId bug.",
    },
    {
      file: "server/src/social/social-repository.ts",
      reason:
        "resolveActorBySession, refreshPresenceFromSessions, and getProfileIdByCharacterId all contain legacy fallbacks that intentionally accept one UUID as profile and character depending on missing rows.",
    },
    {
      file: "server/src/multiplayer/multiplayer-routes.ts",
      reason:
        "Join/session/presence/moderation flows still treat playerUuid as the universal authenticated identity and consult social/profile state only as a fallback.",
    },
    {
      file: "server/src/multiplayer/multiplayer-repository.ts",
      reason:
        "registerPlayer and createSession still persist only player_uuid, so session state cannot answer both 'who is the profile?' and 'which character is active?' without external reconstruction.",
    },
    {
      file: "game/src/app/layout/shell/shell-container.component.ts",
      reason:
        "connectServer and grantAdminRights both send roster.activeCharacter().id as the account/login UUID, so the client still authenticates character-first.",
    },
    {
      file: "game/src/app/core/services/server-connection.service.ts",
      reason:
        "ServerSessionState exposes only playerUuid, so downstream callers cannot distinguish profile identity from active character identity.",
    },
    {
      file: "game/src/app/core/services/server-chat.service.ts",
      reason:
        "Presence and message hydration use currentPlayerUuid and message.playerUuid as primary identity keys, which keeps chat UI tied to the ambiguous legacy field.",
    },
  ],
};
```

## Migration risk summary

- The social layer already contains explicit legacy compatibility code. That is good for safe migration, but it also means a partial refactor can silently keep accepting the old shared-ID behavior.
- `allowed_players.player_uuid` is the highest-risk persistence field because it currently functions as the login target, moderation target, and implicit fallback profile key.
- `server_sessions.player_uuid` is the highest-risk runtime field because it is the source for profile routes, presence hydration, and current-player comparisons in the Angular client.
- The offline save roster already has separate character UUIDs per local save, but there is no canonical persisted local profile UUID yet. Any client migration must create or preserve one deliberately instead of inferring it ad hoc per request.
