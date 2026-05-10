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
  `);

  return db;
}
