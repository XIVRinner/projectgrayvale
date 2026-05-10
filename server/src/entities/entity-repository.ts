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
    const clauses = ["e.entity_type = ?"];
    const params: Array<string | number> = [entityType];

    if (filters.category) {
      clauses.push("e.category = ?");
      params.push(filters.category);
    }

    if (filters.slot) {
      clauses.push("e.slot = ?");
      params.push(filters.slot);
    }

    if (filters.locationId) {
      clauses.push("e.location_id = ?");
      params.push(filters.locationId);
    }

    if (filters.tag) {
      clauses.push(
        "EXISTS (SELECT 1 FROM api_entity_tags t WHERE t.entity_type = e.entity_type AND t.entity_id = e.entity_id AND t.tag = ?)"
      );
      params.push(filters.tag);
    }

    const limit = normalizeOptionalNumber(filters.limit, 500);
    const offset = normalizeOptionalNumber(filters.offset, 0);

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
        WHERE ${clauses.join(" AND ")}
        ORDER BY e.sort_key ASC, e.entity_id ASC
        LIMIT ? OFFSET ?
      `,
      ...params,
      limit,
      offset
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
