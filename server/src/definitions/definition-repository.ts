import type { GrayvaleDatabase } from "../db/database";
import type { DefinitionRecord, DefinitionType } from "./definition-types";

interface RawDefinitionRow {
  readonly type: DefinitionType;
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly json: string;
  readonly source_path: string;
  readonly updated_at: string;
}

export class DefinitionRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async listIds(type: DefinitionType): Promise<readonly string[]> {
    const rows = await this.db.all<Array<{ id: string }>>(
      `
        SELECT id
        FROM definitions
        WHERE type = ?
        ORDER BY id ASC
      `,
      type,
    );

    return rows.map((row) => row.id);
  }

  async list(type: DefinitionType): Promise<readonly DefinitionRecord[]> {
    const rows = await this.db.all<RawDefinitionRow[]>(
      `
        SELECT type, id, version, hash, json, source_path, updated_at
        FROM definitions
        WHERE type = ?
        ORDER BY id ASC
      `,
      type,
    );

    return rows.map(mapDefinitionRow);
  }

  async get(type: DefinitionType, id: string): Promise<DefinitionRecord | null> {
    const row = await this.db.get<RawDefinitionRow>(
      `
        SELECT type, id, version, hash, json, source_path, updated_at
        FROM definitions
        WHERE type = ? AND id = ?
      `,
      type,
      id,
    );

    return row ? mapDefinitionRow(row) : null;
  }

  async getManyByIds(
    type: DefinitionType,
    ids: readonly string[],
  ): Promise<readonly DefinitionRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.db.all<RawDefinitionRow[]>(
      `
        SELECT type, id, version, hash, json, source_path, updated_at
        FROM definitions
        WHERE type = ?
          AND id IN (
            SELECT value
            FROM json_each(?)
          )
      `,
      type,
      JSON.stringify(ids),
    );

    const recordsById = new Map(rows.map((row) => [row.id, mapDefinitionRow(row)]));

    return ids
      .map((id) => recordsById.get(id))
      .filter((record): record is DefinitionRecord => record !== undefined);
  }

  async upsert(definition: {
    readonly type: DefinitionType;
    readonly id: string;
    readonly version: string;
    readonly hash: string;
    readonly json: string;
    readonly sourcePath: string;
  }): Promise<void> {
    await this.db.run(
      `
        INSERT INTO definitions (
          type,
          id,
          version,
          hash,
          json,
          source_path,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(type, id) DO UPDATE SET
          version = excluded.version,
          hash = excluded.hash,
          json = excluded.json,
          source_path = excluded.source_path,
          updated_at = CURRENT_TIMESTAMP
      `,
      definition.type,
      definition.id,
      definition.version,
      definition.hash,
      definition.json,
      definition.sourcePath,
    );
  }
}

function mapDefinitionRow(row: RawDefinitionRow): DefinitionRecord {
  return {
    type: row.type,
    id: row.id,
    version: row.version,
    hash: row.hash,
    json: row.json,
    sourcePath: row.source_path,
    updatedAt: row.updated_at,
  };
}
