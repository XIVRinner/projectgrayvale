import type { GrayvaleDatabase } from "../db/database";
import type { JsonResourceRecord } from "./content-types";

interface RawJsonResourceRow {
  readonly resource_key: string;
  readonly source_path: string;
  readonly payload: string;
  readonly checksum: string;
  readonly updated_at: string;
}

export class ContentRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async listResources(): Promise<readonly JsonResourceRecord[]> {
    const rows = await this.db.all<RawJsonResourceRow[]>(
      `
        SELECT resource_key, source_path, payload, checksum, updated_at
        FROM json_resources
        ORDER BY resource_key ASC
      `
    );

    return rows.map(mapRow);
  }

  async getResource(resourceKey: string): Promise<JsonResourceRecord | null> {
    const row = await this.db.get<RawJsonResourceRow>(
      `
        SELECT resource_key, source_path, payload, checksum, updated_at
        FROM json_resources
        WHERE resource_key = ?
      `,
      resourceKey
    );

    return row ? mapRow(row) : null;
  }
}

function mapRow(row: RawJsonResourceRow): JsonResourceRecord {
  return {
    resourceKey: row.resource_key,
    sourcePath: row.source_path,
    payload: row.payload,
    checksum: row.checksum,
    updatedAt: row.updated_at
  };
}
