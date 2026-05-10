import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

export type GrayvaleDatabase = Database<sqlite3.Database, sqlite3.Statement>;

export async function openDatabase(filename: string): Promise<GrayvaleDatabase> {
  await mkdir(dirname(filename), { recursive: true });

  const db = await open({
    filename,
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;
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
  `);

  return db;
}
