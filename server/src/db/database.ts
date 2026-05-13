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
