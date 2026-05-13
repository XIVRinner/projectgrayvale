import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  createClient,
  type Client,
  type InValue,
  type Transaction,
} from "@libsql/client";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

export interface GrayvaleDatabase {
  exec(sql: string): Promise<void>;
  run(
    sql: string,
    ...params: readonly unknown[]
  ): Promise<{ readonly lastID?: number; readonly changes?: number }>;
  get<T>(sql: string, ...params: readonly unknown[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: readonly unknown[]): Promise<T>;
}

interface OpenDatabaseOptions {
  readonly databaseProvider: "sqlite" | "turso";
  readonly dbFilePath: string;
  readonly tursoDatabaseUrl?: string;
  readonly tursoAuthToken?: string;
}

export async function openDatabase(
  options: OpenDatabaseOptions,
): Promise<GrayvaleDatabase> {
  if (options.databaseProvider === "turso") {
    return openTursoDatabase(options);
  }

  return openSqliteDatabase(options.dbFilePath);
}

async function openSqliteDatabase(filename: string): Promise<GrayvaleDatabase> {
  await mkdir(dirname(filename), { recursive: true });

  const db = await open({
    filename,
    driver: sqlite3.Database,
  });

  await db.exec(buildSchemaSql({ includeLocalPragmas: true }));

  await ensureColumn(db, "allowed_players", "avatar_path", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_timeout_until", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_timeout_reason", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_banned_at", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_ban_reason", "TEXT");
  await ensureColumn(db, "allowed_players", "server_banned_at", "TEXT");
  await ensureColumn(db, "allowed_players", "server_ban_reason", "TEXT");
  await ensureColumn(
    db,
    "allowed_players",
    "moderated_by_player_uuid",
    "TEXT",
  );
  await ensureColumn(db, "allowed_players", "moderated_at", "TEXT");

  return db;
}

async function openTursoDatabase(
  options: OpenDatabaseOptions,
): Promise<GrayvaleDatabase> {
  if (!options.tursoDatabaseUrl || !options.tursoAuthToken) {
    throw new Error(
      "Turso database selected but GRAYVALE_TURSO_DATABASE_URL and GRAYVALE_TURSO_AUTH_TOKEN are not both set.",
    );
  }

  const client = createClient({
    url: options.tursoDatabaseUrl,
    authToken: options.tursoAuthToken,
  });
  const db = new TursoDatabase(client);

  await db.exec(buildSchemaSql({ includeLocalPragmas: false }));
  await ensureColumn(db, "allowed_players", "avatar_path", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_timeout_until", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_timeout_reason", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_banned_at", "TEXT");
  await ensureColumn(db, "allowed_players", "chat_ban_reason", "TEXT");
  await ensureColumn(db, "allowed_players", "server_banned_at", "TEXT");
  await ensureColumn(db, "allowed_players", "server_ban_reason", "TEXT");
  await ensureColumn(
    db,
    "allowed_players",
    "moderated_by_player_uuid",
    "TEXT",
  );
  await ensureColumn(db, "allowed_players", "moderated_at", "TEXT");

  return db;
}

function buildSchemaSql(options: { includeLocalPragmas: boolean }): string {
  const pragmas = options.includeLocalPragmas
    ? `
    PRAGMA journal_mode = WAL;
    `
    : "";

  return `
    ${pragmas}
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS json_resources (
      resource_key TEXT PRIMARY KEY,
      source_path TEXT NOT NULL,
      payload TEXT NOT NULL,
      checksum TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_entities (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      resource_key TEXT NOT NULL,
      display_name TEXT,
      category TEXT,
      slot TEXT,
      location_id TEXT,
      sublocation_id TEXT,
      sort_key INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      checksum TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS api_entity_tags (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (entity_type, entity_id, tag),
      FOREIGN KEY (entity_type, entity_id)
        REFERENCES api_entities (entity_type, entity_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_api_entities_type_sort
      ON api_entities (entity_type, sort_key, entity_id);
    CREATE INDEX IF NOT EXISTS idx_api_entities_category
      ON api_entities (entity_type, category);
    CREATE INDEX IF NOT EXISTS idx_api_entities_slot
      ON api_entities (entity_type, slot);
    CREATE INDEX IF NOT EXISTS idx_api_entities_location
      ON api_entities (entity_type, location_id, sublocation_id);
    CREATE INDEX IF NOT EXISTS idx_api_entity_tags_tag
      ON api_entity_tags (entity_type, tag);

    CREATE TABLE IF NOT EXISTS definitions (
      type TEXT NOT NULL,
      id TEXT NOT NULL,
      version TEXT NOT NULL,
      hash TEXT NOT NULL,
      json TEXT NOT NULL,
      source_path TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (type, id)
    );

    CREATE INDEX IF NOT EXISTS idx_definitions_type
      ON definitions (type, id);

    CREATE TABLE IF NOT EXISTS allowed_players (
      player_uuid TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      rank TEXT NOT NULL DEFAULT 'player',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS server_sessions (
      session_id TEXT PRIMARY KEY,
      player_uuid TEXT NOT NULL,
      client_id TEXT NOT NULL,
      ip_address TEXT,
      connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_uuid)
        REFERENCES allowed_players (player_uuid)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_uuid TEXT,
      event_type TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_uuid)
        REFERENCES allowed_players (player_uuid)
        ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_uuid TEXT NOT NULL,
      rank TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_uuid)
        REFERENCES allowed_players (player_uuid)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_allowed_players_rank
      ON allowed_players (rank);
    CREATE INDEX IF NOT EXISTS idx_server_sessions_player
      ON server_sessions (player_uuid);
    CREATE INDEX IF NOT EXISTS idx_player_audit_logs_player
      ON player_audit_logs (player_uuid, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created
      ON chat_messages (created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS releases (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      released_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS changelog_entries (
      id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      audience TEXT NOT NULL DEFAULT 'user',
      impact TEXT NOT NULL DEFAULT 'low',
      tags TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (release_id)
        REFERENCES releases (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS changelog_reads (
      id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      user_id TEXT,
      client_id TEXT,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (release_id)
        REFERENCES releases (id)
        ON DELETE CASCADE,
      UNIQUE (release_id, user_id),
      UNIQUE (release_id, client_id)
    );

    CREATE INDEX IF NOT EXISTS idx_releases_status_released_at
      ON releases (status, released_at DESC);
    CREATE INDEX IF NOT EXISTS idx_releases_released_at
      ON releases (released_at DESC);
    CREATE INDEX IF NOT EXISTS idx_changelog_entries_release_sort
      ON changelog_entries (release_id, sort_order ASC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_changelog_entries_type
      ON changelog_entries (type);
    CREATE INDEX IF NOT EXISTS idx_changelog_reads_user
      ON changelog_reads (user_id, release_id);
    CREATE INDEX IF NOT EXISTS idx_changelog_reads_client
      ON changelog_reads (client_id, release_id);

    CREATE TABLE IF NOT EXISTS player_profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_characters (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      content_binding_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_player_characters_profile
      ON player_characters (profile_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS player_presence (
      profile_id TEXT PRIMARY KEY,
      profile_display_name TEXT,
      current_character_id TEXT,
      current_character_name TEXT,
      online INTEGER NOT NULL DEFAULT 0,
      last_online_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_player_presence_online
      ON player_presence (online, updated_at DESC);

    CREATE TABLE IF NOT EXISTS social_friend_links (
      profile_id TEXT NOT NULL,
      target_profile_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (profile_id, target_profile_id),
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS social_blocks (
      profile_id TEXT NOT NULL,
      target_profile_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (profile_id, target_profile_id),
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guild_memberships (
      character_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      guild_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (character_id)
        REFERENCES player_characters (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_guild_memberships_profile
      ON guild_memberships (profile_id, joined_at DESC);

    CREATE TABLE IF NOT EXISTS chat_channels_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      owner_profile_id TEXT,
      guild_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, name)
    );

    CREATE TABLE IF NOT EXISTS chat_channel_members_v2 (
      channel_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      banned INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (channel_id, profile_id),
      FOREIGN KEY (channel_id)
        REFERENCES chat_channels_v2 (id)
        ON DELETE CASCADE,
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages_v2 (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      sender_profile_id TEXT,
      sender_character_id TEXT,
      sender_character_name TEXT,
      body TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id)
        REFERENCES chat_channels_v2 (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_v2_channel_created
      ON chat_messages_v2 (channel_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS direct_conversations (
      id TEXT PRIMARY KEY,
      profile_a_id TEXT NOT NULL,
      profile_b_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_conversations_pair
      ON direct_conversations (
        CASE WHEN profile_a_id < profile_b_id THEN profile_a_id ELSE profile_b_id END,
        CASE WHEN profile_a_id < profile_b_id THEN profile_b_id ELSE profile_a_id END
      );

    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_profile_id TEXT NOT NULL,
      sender_character_id TEXT,
      sender_character_name TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id)
        REFERENCES direct_conversations (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
      ON direct_messages (conversation_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS moderation_actions (
      id TEXT PRIMARY KEY,
      target_profile_id TEXT NOT NULL,
      actor_profile_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      starts_at TEXT NOT NULL,
      expires_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (actor_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_active
      ON moderation_actions (target_profile_id, type, active, created_at DESC);

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      actor_profile_id TEXT NOT NULL,
      target_profile_id TEXT,
      action_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
      ON admin_audit_log (created_at DESC);

    CREATE TABLE IF NOT EXISTS admin_profile_notes (
      id TEXT PRIMARY KEY,
      target_profile_id TEXT NOT NULL,
      author_profile_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (author_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_profile_notes_target
      ON admin_profile_notes (target_profile_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS profile_permissions (
      profile_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      granted_by_profile_id TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (profile_id, permission_id),
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (granted_by_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      requester_profile_id TEXT NOT NULL,
      requester_character_id TEXT,
      target_profile_id TEXT NOT NULL,
      target_character_id TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_friendships_profile
      ON friendships (requester_profile_id, target_profile_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS social_privacy_settings (
      profile_id TEXT PRIMARY KEY,
      show_online_to_friends INTEGER NOT NULL DEFAULT 1,
      allow_friend_requests INTEGER NOT NULL DEFAULT 1,
      allow_whispers_from TEXT NOT NULL DEFAULT 'everyone',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blocked_profiles (
      blocker_profile_id TEXT NOT NULL,
      blocked_profile_id TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (blocker_profile_id, blocked_profile_id),
      FOREIGN KEY (blocker_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (blocked_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_by_profile_id TEXT NOT NULL,
      created_by_character_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (created_by_character_id)
        REFERENCES player_characters (id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guild_members (
      guild_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, character_id),
      FOREIGN KEY (guild_id)
        REFERENCES guilds (id)
        ON DELETE CASCADE,
      FOREIGN KEY (profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (character_id)
        REFERENCES player_characters (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_guild_members_profile
      ON guild_members (profile_id, joined_at DESC);

    CREATE TABLE IF NOT EXISTS guild_invitations (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      inviter_profile_id TEXT NOT NULL,
      inviter_character_id TEXT,
      target_profile_id TEXT NOT NULL,
      target_character_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guild_id)
        REFERENCES guilds (id)
        ON DELETE CASCADE,
      FOREIGN KEY (inviter_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_guild_invitations_target
      ON guild_invitations (target_profile_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS system_messages (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT,
      channel_id TEXT,
      body TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_system_messages_target
      ON system_messages (target_type, target_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS player_reports (
      id TEXT PRIMARY KEY,
      reporter_profile_id TEXT NOT NULL,
      target_profile_id TEXT,
      target_message_id TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE CASCADE,
      FOREIGN KEY (target_profile_id)
        REFERENCES player_profiles (id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_player_reports_status
      ON player_reports (status, created_at DESC);
  `;
}

async function ensureColumn(
  db: GrayvaleDatabase,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): Promise<void> {
  const columns = await db.all<Array<{ name: string }>>(
    `PRAGMA table_info(${tableName})`,
  );

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await db.exec(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
  );
}

class TursoDatabase implements GrayvaleDatabase {
  private transaction: Transaction | null = null;

  constructor(private readonly client: Client) {}

  async exec(sql: string): Promise<void> {
    const command = parseTransactionCommand(sql);

    if (command === "begin") {
      if (this.transaction && !this.transaction.closed) {
        throw new Error("Transaction already active.");
      }

      this.transaction = await this.client.transaction("write");
      return;
    }

    if (command === "commit") {
      if (!this.transaction) {
        return;
      }

      const activeTransaction = this.transaction;
      this.transaction = null;

      try {
        await activeTransaction.commit();
      } finally {
        activeTransaction.close();
      }

      return;
    }

    if (command === "rollback") {
      if (!this.transaction) {
        return;
      }

      const activeTransaction = this.transaction;
      this.transaction = null;

      try {
        await activeTransaction.rollback();
      } finally {
        activeTransaction.close();
      }

      return;
    }

    if (this.transaction) {
      await this.transaction.executeMultiple(sql);
      return;
    }

    await this.client.executeMultiple(sql);
  }

  async run(
    sql: string,
    ...params: readonly unknown[]
  ): Promise<{ readonly lastID?: number; readonly changes?: number }> {
    const result = await this.executeStatement(sql, params);

    return {
      lastID: toSafeNumber(result.lastInsertRowid),
      changes: result.rowsAffected,
    };
  }

  async get<T>(sql: string, ...params: readonly unknown[]): Promise<T | undefined> {
    const result = await this.executeStatement(sql, params);
    const firstRow = result.rows[0];

    return firstRow ? (firstRow as T) : undefined;
  }

  async all<T>(sql: string, ...params: readonly unknown[]): Promise<T> {
    const result = await this.executeStatement(sql, params);

    return result.rows as T;
  }

  private executeStatement(sql: string, params: readonly unknown[]) {
    const args = normalizeParams(params);

    if (this.transaction) {
      return this.transaction.execute({ sql, args });
    }

    return this.client.execute(sql, args);
  }
}

function normalizeParams(params: readonly unknown[]): InValue[] {
  return params.map((param) => normalizeParam(param));
}

function normalizeParam(param: unknown): InValue {
  if (param === undefined || param === null) {
    return null;
  }

  if (typeof param === "string" || typeof param === "number" || typeof param === "bigint") {
    return param;
  }

  if (param instanceof ArrayBuffer) {
    return new Uint8Array(param);
  }

  if (param instanceof Uint8Array) {
    return param;
  }

  if (typeof param === "boolean") {
    return param ? 1 : 0;
  }

  if (param instanceof Date) {
    return param.toISOString();
  }

  return String(param);
}

function parseTransactionCommand(sql: string): "begin" | "commit" | "rollback" | undefined {
  const normalized = sql.trim().replace(/;+/g, "").toUpperCase();

  if (normalized === "BEGIN" || normalized === "BEGIN TRANSACTION" || normalized === "BEGIN IMMEDIATE") {
    return "begin";
  }

  if (normalized === "COMMIT" || normalized === "END") {
    return "commit";
  }

  if (normalized === "ROLLBACK") {
    return "rollback";
  }

  return undefined;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
