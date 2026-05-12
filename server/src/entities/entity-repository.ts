import type { GrayvaleDatabase } from "../db/database";
import type { ApiEntityRecord, EntityListFilters } from "./entity-types";

interface RawEntityRow {
  readonly entity_type: string;
  readonly entity_id: string;
  readonly resource_key: string;
  readonly display_name: string | null;
  readonly category: string | null;
  readonly slot: string | null;
  readonly location_id: string | null;
  readonly sublocation_id: string | null;
  readonly sort_key: number;
  readonly payload: string;
  readonly checksum: string;
  readonly updated_at: string;
}

export class EntityRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async list(entityType: string, filters: EntityListFilters = {}): Promise<readonly ApiEntityRecord[]> {
    const limit = normalizeEntityLimit(filters.limit);
    const offset = normalizeOptionalNumber(filters.offset, 0);

    // Fixed query with optional filters expressed as nullable parameters so that
    // no user input is ever interpolated into the SQL string.
    //
    // Each optional filter binds the same value twice:
    //   bind 1 → IS NULL check  (NULL means "skip this filter")
    //   bind 2 → equality check (the actual value when the filter is active)
    // This is intentional — SQLite requires the value to appear once in each
    // clause position, and COALESCE / CASE would be more verbose for no gain.
    const rows = await this.db.all<RawEntityRow[]>(
      `
        SELECT
          e.entity_type,
          e.entity_id,
          e.resource_key,
          e.display_name,
          e.category,
          e.slot,
          e.location_id,
          e.sublocation_id,
          e.sort_key,
          e.payload,
          e.checksum,
          e.updated_at
        FROM api_entities e
        WHERE e.entity_type = ?
          AND (? IS NULL OR e.category = ?)
          AND (? IS NULL OR e.slot = ?)
          AND (? IS NULL OR e.location_id = ?)
          AND (? IS NULL OR EXISTS (
            SELECT 1 FROM api_entity_tags t
            WHERE t.entity_type = e.entity_type
              AND t.entity_id = e.entity_id
              AND t.tag = ?
          ))
        ORDER BY e.sort_key ASC, e.entity_id ASC
        LIMIT ? OFFSET ?
      `,
      entityType,
      filters.category ?? null,
      filters.category ?? null,
      filters.slot ?? null,
      filters.slot ?? null,
      filters.locationId ?? null,
      filters.locationId ?? null,
      filters.tag ?? null,
      filters.tag ?? null,
      limit,
      offset,
    );

    return rows.map(mapEntityRow);
  }

  async get(entityType: string, entityId: string): Promise<ApiEntityRecord | null> {
    const row = await this.db.get<RawEntityRow>(
      `
        SELECT
          entity_type,
          entity_id,
          resource_key,
          display_name,
          category,
          slot,
          location_id,
          sublocation_id,
          sort_key,
          payload,
          checksum,
          updated_at
        FROM api_entities
        WHERE entity_type = ? AND entity_id = ?
      `,
      entityType,
      entityId
    );

    return row ? mapEntityRow(row) : null;
  }
}

function mapEntityRow(row: RawEntityRow): ApiEntityRecord {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    resourceKey: row.resource_key,
    displayName: row.display_name ?? undefined,
    category: row.category ?? undefined,
    slot: row.slot ?? undefined,
    locationId: row.location_id ?? undefined,
    sublocationId: row.sublocation_id ?? undefined,
    sortKey: row.sort_key,
    payload: row.payload,
    checksum: row.checksum,
    updatedAt: row.updated_at
  };
}

function normalizeOptionalNumber(raw: number | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }

  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error("Pagination values must be non-negative integers.");
  }

  return raw;
}

const ENTITY_LIST_MAX_LIMIT = 500;

function normalizeEntityLimit(raw: number | undefined): number {
  const value = normalizeOptionalNumber(raw, ENTITY_LIST_MAX_LIMIT);

  return Math.min(value, ENTITY_LIST_MAX_LIMIT);
}
