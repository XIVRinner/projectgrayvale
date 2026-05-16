import { randomUUID } from "node:crypto";

import type { GrayvaleDatabase } from "../db/database";
import type {
  CharacterContentBinding,
  PlayerCharacterRecord,
  PlayerCharacterSummary,
  PlayerProfileRecord,
  PlayerProfileSummary,
} from "./player-profile-types";

interface PlayerProfileRow {
  readonly id: string;
  readonly display_name: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface PlayerCharacterRow {
  readonly id: string;
  readonly profile_id: string;
  readonly name: string;
  readonly content_binding_json: string | null;
  readonly save_data_json: string | null;
  readonly portrait_shard_id: string | null;
  readonly snapshot_level: number | null;
  readonly snapshot_location_id: string | null;
  readonly snapshot_last_location_name: string | null;
  readonly last_played_at: string | null;
  readonly online: number | null;
  readonly guild_id: string | null;
  readonly guild_name: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class PlayerProfileRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  /**
   * Find a player profile by the player's UUID (same as allowed_players.player_uuid).
   * In this design, PlayerProfile.id === AllowedPlayer.player_uuid.
   */
  async getProfile(profileId: string): Promise<PlayerProfileRecord | null> {
    const row = await this.db.get<PlayerProfileRow>(
      `
        SELECT id, display_name, created_at, updated_at
        FROM player_profiles
        WHERE id = ?
      `,
      profileId,
    );

    if (!row) {
      return null;
    }

    const characters = await this.getCharactersForProfile(profileId);

    return mapProfileRow(row, characters);
  }

  /**
   * Upsert a player profile. Creates it if missing, otherwise touches updated_at.
   * Profile ID mirrors the player UUID from allowed_players.
   */
  async upsertProfile(
    profileId: string,
    displayName?: string,
  ): Promise<PlayerProfileRecord> {
    const existing = await this.getProfile(profileId);

    if (existing) {
      if (displayName !== undefined) {
        await this.db.run(
          `
            UPDATE player_profiles
            SET display_name = ?, updated_at = ?
            WHERE id = ?
          `,
          displayName ?? null,
          new Date().toISOString(),
          profileId,
        );
      }

      return (await this.getProfile(profileId))!;
    }

    const now = new Date().toISOString();

    await this.db.run(
      `
        INSERT INTO player_profiles (id, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
      profileId,
      displayName ?? null,
      now,
      now,
    );

    const created = await this.getProfile(profileId);

    if (!created) {
      throw new Error("player_profile_create_failed");
    }

    return created;
  }

  async updateProfileDisplayName(profileId: string, displayName: string): Promise<void> {
    const normalized = displayName.trim();
    const now = new Date().toISOString();

    await this.db.run(
      `
        UPDATE player_profiles
        SET display_name = ?,
            updated_at = ?
        WHERE id = ?
      `,
      normalized,
      now,
      profileId,
    );

    await this.db.run(
      `
        UPDATE allowed_players
        SET display_name = ?,
            updated_at = ?
        WHERE player_uuid = ?
      `,
      normalized,
      now,
      profileId,
    );
  }

  async getCharacter(characterId: string): Promise<PlayerCharacterRecord | null> {
    const row = await this.db.get<PlayerCharacterRow>(
      `
        SELECT
          id,
          profile_id,
          name,
          content_binding_json,
          save_data_json,
          portrait_shard_id,
          snapshot_level,
          snapshot_location_id,
          snapshot_last_location_name,
          last_played_at,
          NULL AS online,
          NULL AS guild_id,
          NULL AS guild_name,
          created_at,
          updated_at
        FROM player_characters
        WHERE id = ?
      `,
      characterId,
    );

    return row ? mapCharacterRow(row) : null;
  }

  async getCharactersForProfile(profileId: string): Promise<readonly PlayerCharacterRecord[]> {
    const rows = await this.db.all<PlayerCharacterRow[]>(
      `
        SELECT
          player_characters.id,
          player_characters.profile_id,
          player_characters.name,
          player_characters.content_binding_json,
          player_characters.save_data_json,
          player_characters.portrait_shard_id,
          player_characters.snapshot_level,
          player_characters.snapshot_location_id,
          player_characters.snapshot_last_location_name,
          player_characters.last_played_at,
          CASE
            WHEN player_presence.current_character_id = player_characters.id
              AND player_presence.online = 1
            THEN 1
            ELSE 0
          END AS online,
          guild_members.guild_id,
          guilds.name AS guild_name,
          player_characters.created_at,
          player_characters.updated_at
        FROM player_characters
        LEFT JOIN player_presence
          ON player_presence.profile_id = player_characters.profile_id
        LEFT JOIN guild_members
          ON guild_members.character_id = player_characters.id
        LEFT JOIN guilds
          ON guilds.id = guild_members.guild_id
        WHERE player_characters.profile_id = ?
        ORDER BY player_characters.created_at ASC
      `,
      profileId,
    );

    return rows.map(mapCharacterRow);
  }

  async createCharacter(
    profileId: string,
    name: string,
    contentBinding: CharacterContentBinding | null,
    initialSnapshot?: {
      portraitShardId?: string;
      level?: number;
      locationId?: string;
      lastLocationName?: string;
    },
  ): Promise<PlayerCharacterRecord> {
    const characterId = randomUUID();
    assertProfileCharacterDifferent(profileId, characterId);
    const now = new Date().toISOString();

    await this.db.run(
      `
        INSERT INTO player_characters (
          id,
          profile_id,
          name,
          content_binding_json,
          portrait_shard_id,
          snapshot_level,
          snapshot_location_id,
          snapshot_last_location_name,
          created_at,
          updated_at,
          last_played_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      characterId,
      profileId,
      name.trim(),
      contentBinding ? JSON.stringify(contentBinding) : null,
      normalizeOptionalString(initialSnapshot?.portraitShardId),
      normalizeOptionalLevel(initialSnapshot?.level),
      normalizeOptionalString(initialSnapshot?.locationId),
      normalizeOptionalString(initialSnapshot?.lastLocationName),
      now,
      now,
      now,
    );

    const created = await this.getCharacter(characterId);

    if (!created) {
      throw new Error("player_character_create_failed");
    }

    return created;
  }

  async registerCharacter(
    profileId: string,
    input: {
      characterId: string;
      characterName: string;
      portraitShardId: string;
      level?: number;
      locationId?: string;
      lastLocationName?: string;
    },
    contentBinding: CharacterContentBinding | null,
  ): Promise<{
    status: "created" | "refreshed";
    character: PlayerCharacterRecord;
  }> {
    assertProfileCharacterDifferent(profileId, input.characterId);
    await this.upsertProfile(profileId);

    const existing = await this.getCharacter(input.characterId);
    const normalizedName = input.characterName.trim();
    const normalizedPortraitShardId = normalizeRequiredString(input.portraitShardId);

    if (!normalizedPortraitShardId) {
      throw new Error("invalid_character_portrait");
    }

    if (!existing) {
      const now = new Date().toISOString();

      await this.db.run(
        `
          INSERT INTO player_characters (
            id,
            profile_id,
            name,
            content_binding_json,
            portrait_shard_id,
            snapshot_level,
            snapshot_location_id,
            snapshot_last_location_name,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        input.characterId,
        profileId,
        normalizedName,
        contentBinding ? JSON.stringify(contentBinding) : null,
        normalizedPortraitShardId,
        normalizeOptionalLevel(input.level),
        normalizeOptionalString(input.locationId),
        normalizeOptionalString(input.lastLocationName),
        now,
        now,
      );

      const created = await this.getCharacter(input.characterId);

      if (!created) {
        throw new Error("player_character_create_failed");
      }

      return {
        status: "created",
        character: created,
      };
    }

    if (existing.profileId !== profileId) {
      throw new Error("character_profile_conflict");
    }

    if (existing.name.trim() !== normalizedName) {
      throw new Error("character_tamper_detected");
    }

    if (
      existing.portraitShardId &&
      existing.portraitShardId.trim() !== normalizedPortraitShardId
    ) {
      throw new Error("character_tamper_detected");
    }

    const nextPortraitShardId = existing.portraitShardId ?? normalizedPortraitShardId;

    await this.db.run(
      `
        UPDATE player_characters
        SET content_binding_json = COALESCE(content_binding_json, ?),
            portrait_shard_id = COALESCE(portrait_shard_id, ?),
            snapshot_level = COALESCE(?, snapshot_level),
            snapshot_location_id = COALESCE(?, snapshot_location_id),
            snapshot_last_location_name = COALESCE(?, snapshot_last_location_name),
            updated_at = ?
        WHERE id = ?
      `,
      contentBinding ? JSON.stringify(contentBinding) : null,
      nextPortraitShardId,
      normalizeOptionalLevel(input.level),
      normalizeOptionalString(input.locationId),
      normalizeOptionalString(input.lastLocationName),
      new Date().toISOString(),
      input.characterId,
    );

    const refreshed = await this.getCharacter(input.characterId);

    if (!refreshed) {
      throw new Error("player_character_refresh_failed");
    }

    return {
      status: "refreshed",
      character: refreshed,
    };
  }

  async registerActiveCharacter(
    profileId: string,
    characterId: string,
    snapshot?: {
      level?: number;
      locationId?: string;
      lastLocationName?: string;
    },
  ): Promise<PlayerCharacterRecord> {
    const existing = await this.getCharacter(characterId);

    if (!existing || existing.profileId !== profileId) {
      throw new Error("character_not_registered");
    }

    if (snapshot) {
      await this.updateCharacterSnapshot(characterId, {
        level: snapshot.level,
        locationId: snapshot.locationId,
        lastLocationName: snapshot.lastLocationName,
      });
    }

    await this.markCharacterSelected(characterId);
    const updated = await this.getCharacter(characterId);

    if (!updated) {
      throw new Error("character_not_registered");
    }

    return updated;
  }

  async deleteCharacter(profileId: string, characterId: string): Promise<boolean> {
    const result = await this.db.run(
      `
        DELETE FROM player_characters
        WHERE id = ? AND profile_id = ?
      `,
      characterId,
      profileId,
    );

    return (result.changes ?? 0) > 0;
  }

  async updateCharacterBinding(
    characterId: string,
    contentBinding: CharacterContentBinding | null,
  ): Promise<void> {
    await this.db.run(
      `
        UPDATE player_characters
        SET content_binding_json = ?, updated_at = ?
        WHERE id = ?
      `,
      contentBinding ? JSON.stringify(contentBinding) : null,
      new Date().toISOString(),
      characterId,
    );
  }

  async updateCharacterSnapshot(
    characterId: string,
    snapshot: {
      portraitShardId?: string;
      level?: number;
      locationId?: string;
      lastLocationName?: string;
    },
  ): Promise<void> {
    await this.db.run(
      `
        UPDATE player_characters
        SET portrait_shard_id = COALESCE(?, portrait_shard_id),
            snapshot_level = COALESCE(?, snapshot_level),
            snapshot_location_id = COALESCE(?, snapshot_location_id),
            snapshot_last_location_name = COALESCE(?, snapshot_last_location_name),
            updated_at = ?
        WHERE id = ?
      `,
      normalizeOptionalString(snapshot.portraitShardId),
      normalizeOptionalLevel(snapshot.level),
      normalizeOptionalString(snapshot.locationId),
      normalizeOptionalString(snapshot.lastLocationName),
      new Date().toISOString(),
      characterId,
    );
  }

  async markCharacterSelected(characterId: string): Promise<void> {
    await this.db.run(
      `
        UPDATE player_characters
        SET last_played_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      new Date().toISOString(),
      new Date().toISOString(),
      characterId,
    );
  }

  async getProfileSummary(profileId: string): Promise<PlayerProfileSummary | null> {
    await this.backfillSnapshotsFromSaveData(profileId);

    const profile = await this.getProfile(profileId);

    if (!profile) {
      return null;
    }

    return mapToSummary(profile);
  }

  private async backfillSnapshotsFromSaveData(profileId: string): Promise<void> {
    const rows = await this.db.all<Array<{
      id: string;
      save_data_json: string | null;
      portrait_shard_id: string | null;
      snapshot_level: number | null;
      snapshot_location_id: string | null;
      snapshot_last_location_name: string | null;
    }>>(
      `
        SELECT
          id,
          save_data_json,
          portrait_shard_id,
          snapshot_level,
          snapshot_location_id,
          snapshot_last_location_name
        FROM player_characters
        WHERE profile_id = ?
          AND save_data_json IS NOT NULL
          AND (
            portrait_shard_id IS NULL
            OR snapshot_level IS NULL
            OR snapshot_location_id IS NULL
            OR snapshot_last_location_name IS NULL
          )
      `,
      profileId,
    );

    for (const row of rows) {
      const snapshot = parseSnapshotFromSaveData(row.save_data_json);

      if (!snapshot) {
        continue;
      }

      const portraitShardId = row.portrait_shard_id ?? snapshot.portraitShardId ?? null;
      const level = row.snapshot_level ?? snapshot.level ?? null;
      const locationId = row.snapshot_location_id ?? snapshot.locationId ?? null;
      const lastLocationName =
        row.snapshot_last_location_name ??
        snapshot.lastLocationName ??
        (locationId ? humanizeLocationId(locationId) : null);

      if (
        portraitShardId === row.portrait_shard_id &&
        level === row.snapshot_level &&
        locationId === row.snapshot_location_id &&
        lastLocationName === row.snapshot_last_location_name
      ) {
        continue;
      }

      await this.db.run(
        `
          UPDATE player_characters
          SET portrait_shard_id = ?,
              snapshot_level = ?,
              snapshot_location_id = ?,
              snapshot_last_location_name = ?,
              updated_at = ?
          WHERE id = ?
        `,
        portraitShardId,
        level,
        locationId,
        lastLocationName,
        new Date().toISOString(),
        row.id,
      );
    }
  }
}

function mapProfileRow(
  row: PlayerProfileRow,
  characters: readonly PlayerCharacterRecord[],
): PlayerProfileRecord {
  return {
    id: row.id,
    displayName: row.display_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    characters,
  };
}

function mapCharacterRow(row: PlayerCharacterRow): PlayerCharacterRecord {
  let contentBinding: CharacterContentBinding | null = null;

  if (row.content_binding_json) {
    try {
      contentBinding = parseContentBinding(JSON.parse(row.content_binding_json) as unknown);
    } catch {
      contentBinding = null;
    }
  }

  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    portraitShardId: row.portrait_shard_id ?? undefined,
    level: row.snapshot_level ?? undefined,
    locationId: row.snapshot_location_id ?? undefined,
    lastLocationName: row.snapshot_last_location_name ?? undefined,
    online: row.online ? true : undefined,
    lastPlayedAt: row.last_played_at ?? undefined,
    contentBinding: contentBinding ?? undefined,
    guildId: row.guild_id ?? undefined,
    guildName: row.guild_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseContentBinding(raw: unknown): CharacterContentBinding | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (
    typeof record["serverName"] !== "string" ||
    typeof record["customContent"] !== "boolean" ||
    typeof record["profileToken"] !== "string" ||
    typeof record["acceptedAt"] !== "string"
  ) {
    return null;
  }

  return {
    serverName: record["serverName"],
    customContent: record["customContent"],
    profileToken: record["profileToken"],
    acceptedAt: record["acceptedAt"],
  };
}

function mapToSummary(profile: PlayerProfileRecord): PlayerProfileSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    characters: profile.characters.map(
      (char): PlayerCharacterSummary => ({
        id: char.id,
        profileId: char.profileId,
        name: char.name,
        portraitShardId: char.portraitShardId,
        level: char.level,
        locationId: char.locationId,
        lastLocationName: char.lastLocationName,
        online: char.online,
        lastPlayedAt: char.lastPlayedAt,
        contentBinding: char.contentBinding,
        guildId: char.guildId,
        guildName: char.guildName,
      }),
    ),
  };
}

function assertProfileCharacterDifferent(profileId: string, characterId: string): void {
  if (profileId === characterId) {
    throw new Error("Profile ID and Character ID must be different.");
  }
}

function normalizeOptionalString(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeRequiredString(value);
  return normalized;
}

function normalizeRequiredString(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalLevel(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }

  return value;
}

function parseSnapshotFromSaveData(saveDataJson: string | null): {
  portraitShardId?: string;
  level?: number;
  locationId?: string;
  lastLocationName?: string;
} | null {
  if (!saveDataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(saveDataJson) as unknown;
    const player = extractPlayerSnapshotRecord(parsed);

    if (!player) {
      return null;
    }

    const level = readPositiveInteger(player["progression"], "level");
    const locationId = readOptionalLocationId(player);
    const portraitShardId = readPortraitShardId(player);

    return {
      portraitShardId: portraitShardId ?? undefined,
      level: level ?? undefined,
      locationId: locationId ?? undefined,
      lastLocationName: locationId ? humanizeLocationId(locationId) : undefined,
    };
  } catch {
    return null;
  }
}

function extractPlayerSnapshotRecord(raw: unknown): Record<string, unknown> | null {
  const root = ensureRecord(raw);

  if (!root) {
    return null;
  }

  const nestedPlayer = ensureRecord(root["player"]);
  return nestedPlayer ?? root;
}

function ensureRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  return raw as Record<string, unknown>;
}

function readPositiveInteger(rawParent: unknown, childKey: string): number | null {
  const parent = ensureRecord(rawParent);

  if (!parent) {
    return null;
  }

  const raw = parent[childKey];

  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    return null;
  }

  return raw;
}

function readOptionalLocationId(player: Record<string, unknown>): string | null {
  const interactionState = ensureRecord(player["interactionState"]);

  if (!interactionState) {
    return null;
  }

  const lastButtonPress = ensureRecord(interactionState["lastButtonPress"]);
  const fromLastPress = readNonEmptyString(lastButtonPress?.["locationId"]);

  if (fromLastPress) {
    return fromLastPress;
  }

  const recentPresses = Array.isArray(interactionState["recentButtonPresses"])
    ? interactionState["recentButtonPresses"]
    : [];

  for (let index = recentPresses.length - 1; index >= 0; index -= 1) {
    const entry = ensureRecord(recentPresses[index]);
    const value = readNonEmptyString(entry?.["locationId"]);

    if (value) {
      return value;
    }
  }

  return null;
}

function readPortraitShardId(player: Record<string, unknown>): string | null {
  const explicit = readNonEmptyString(player["portraitShardId"]);

  if (explicit) {
    return explicit;
  }

  const raceId = readNonEmptyString(player["raceId"]);
  const selectedAppearance = ensureRecord(player["selectedAppearance"]);
  const variant = readNonEmptyString(selectedAppearance?.["variant"]);
  const imageIndexRaw = selectedAppearance?.["imageIndex"];

  if (
    !raceId ||
    !variant ||
    (variant !== "warm" && variant !== "cool" && variant !== "exotic") ||
    typeof imageIndexRaw !== "number" ||
    !Number.isInteger(imageIndexRaw) ||
    imageIndexRaw < 0
  ) {
    return null;
  }

  return `${raceId}:${variant}:${imageIndexRaw}`;
}

function readNonEmptyString(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function humanizeLocationId(locationId: string): string {
  return locationId
    .split(/[-_]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}
