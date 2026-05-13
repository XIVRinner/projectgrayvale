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

  async getCharacter(characterId: string): Promise<PlayerCharacterRecord | null> {
    const row = await this.db.get<PlayerCharacterRow>(
      `
        SELECT id, profile_id, name, content_binding_json, created_at, updated_at
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
        SELECT id, profile_id, name, content_binding_json, created_at, updated_at
        FROM player_characters
        WHERE profile_id = ?
        ORDER BY created_at ASC
      `,
      profileId,
    );

    return rows.map(mapCharacterRow);
  }

  async createCharacter(
    profileId: string,
    name: string,
    contentBinding: CharacterContentBinding | null,
  ): Promise<PlayerCharacterRecord> {
    const characterId = randomUUID();
    const now = new Date().toISOString();

    await this.db.run(
      `
        INSERT INTO player_characters (id, profile_id, name, content_binding_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      characterId,
      profileId,
      name.trim(),
      contentBinding ? JSON.stringify(contentBinding) : null,
      now,
      now,
    );

    const created = await this.getCharacter(characterId);

    if (!created) {
      throw new Error("player_character_create_failed");
    }

    return created;
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

  async getProfileSummary(profileId: string): Promise<PlayerProfileSummary | null> {
    const profile = await this.getProfile(profileId);

    if (!profile) {
      return null;
    }

    return mapToSummary(profile);
  }
}

function mapProfileRow(
  row: PlayerProfileRow,
  characters: readonly PlayerCharacterRecord[],
): PlayerProfileRecord {
  return {
    id: row.id,
    displayName: row.display_name,
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
    contentBinding,
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
        name: char.name,
        contentBinding: char.contentBinding,
        createdAt: char.createdAt,
        updatedAt: char.updatedAt,
      }),
    ),
  };
}
