import { randomUUID } from "node:crypto";

import type {
  ChangelogEntry,
  ChangelogEntryType,
  ChangelogRelease,
  ReleaseStatus,
} from "@rinner/grayvale-core";

import type { GrayvaleDatabase } from "../db/database";
import type {
  ChangelogListQuery,
  CreateEntryInput,
  CreateReleaseInput,
  UpdateEntryInput,
  UpdateReleaseInput,
} from "./changelog-validation";

export interface ChangelogViewerContext {
  readonly userId?: string;
  readonly clientId?: string;
  readonly canViewInternal: boolean;
}

interface ReleaseRow {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: ReleaseStatus;
  readonly released_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly is_read?: number | boolean | null;
}

interface EntryRow {
  readonly id: string;
  readonly release_id: string;
  readonly type: ChangelogEntryType;
  readonly title: string;
  readonly body: string | null;
  readonly audience: "user" | "admin" | "developer" | "internal";
  readonly impact: "low" | "medium" | "high";
  readonly tags: string;
  readonly sort_order: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface CountRow {
  readonly count: number;
}

export class ChangelogRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async listPublishedReleases(
    filters: ChangelogListQuery,
    viewer: ChangelogViewerContext,
  ): Promise<readonly ChangelogRelease[]> {
    const releaseRows = await this.listPublishedReleaseRows(filters, viewer);

    if (releaseRows.length === 0) {
      return [];
    }

    const entries = await this.listEntriesForReleaseIds(
      releaseRows.map((release) => release.id),
      filters,
      viewer,
    );

    return hydrateReleases(releaseRows, entries);
  }

  async countPublishedReleases(
    filters: ChangelogListQuery,
    viewer: ChangelogViewerContext,
  ): Promise<number> {
    const entryPredicate = buildEntryPredicate("e", filters, viewer);

    if (entryPredicate.impossible) {
      return 0;
    }

    const clauses = [
      "r.status = 'published'",
      "EXISTS (SELECT 1 FROM changelog_entries e WHERE e.release_id = r.id AND " +
        entryPredicate.sql +
        ")",
    ];
    const params = [...entryPredicate.params];

    if (filters.since) {
      clauses.push("r.released_at >= ?");
      params.push(filters.since);
    }

    const row = await this.db.get<CountRow>(
      `
        SELECT COUNT(*) AS count
        FROM releases r
        WHERE ${clauses.join(" AND ")}
      `,
      ...params,
    );

    return row?.count ?? 0;
  }

  async countUnreadPublishedReleases(viewer: {
    readonly userId?: string;
    readonly clientId?: string;
  }): Promise<number> {
    if (!viewer.userId && !viewer.clientId) {
      return 0;
    }

    const identityColumn = viewer.userId ? "user_id" : "client_id";
    const identityValue = viewer.userId ?? viewer.clientId;
    const row = await this.db.get<CountRow>(
      `
        SELECT COUNT(*) AS count
        FROM releases r
        WHERE r.status = 'published'
          AND EXISTS (
            SELECT 1
            FROM changelog_entries e
            WHERE e.release_id = r.id
              AND e.audience <> 'internal'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM changelog_reads reads
            WHERE reads.release_id = r.id
              AND reads.${identityColumn} = ?
          )
      `,
      identityValue,
    );

    return row?.count ?? 0;
  }

  async markReleaseRead(input: {
    readonly releaseId: string;
    readonly userId?: string;
    readonly clientId?: string;
  }): Promise<void> {
    if (input.userId) {
      await this.db.run(
        `
          INSERT INTO changelog_reads (id, release_id, user_id, client_id, read_at)
          VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP)
          ON CONFLICT(release_id, user_id)
          DO UPDATE SET read_at = CURRENT_TIMESTAMP
        `,
        randomUUID(),
        input.releaseId,
        input.userId,
      );
      return;
    }

    if (input.clientId) {
      await this.db.run(
        `
          INSERT INTO changelog_reads (id, release_id, user_id, client_id, read_at)
          VALUES (?, ?, NULL, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(release_id, client_id)
          DO UPDATE SET read_at = CURRENT_TIMESTAMP
        `,
        randomUUID(),
        input.releaseId,
        input.clientId,
      );
    }
  }

  async createRelease(input: CreateReleaseInput): Promise<ChangelogRelease> {
    const id = randomUUID();
    const status = input.status ?? "draft";

    await this.db.run(
      `
        INSERT INTO releases (id, version, title, summary, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      id,
      input.version,
      input.title,
      input.summary ?? null,
      status,
    );

    const release = await this.getAdminReleaseById(id);

    if (!release) {
      throw new Error("release_create_failed");
    }

    return release;
  }

  async updateRelease(
    releaseId: string,
    input: UpdateReleaseInput,
  ): Promise<ChangelogRelease | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (input.version !== undefined) {
      assignments.push("version = ?");
      params.push(input.version);
    }

    if (input.title !== undefined) {
      assignments.push("title = ?");
      params.push(input.title);
    }

    if (input.summary !== undefined) {
      assignments.push("summary = ?");
      params.push(input.summary ?? null);
    }

    if (input.status !== undefined) {
      assignments.push("status = ?");
      params.push(input.status);
    }

    assignments.push("updated_at = CURRENT_TIMESTAMP");

    const result = await this.db.run(
      `
        UPDATE releases
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      ...params,
      releaseId,
    );

    if (!result.changes) {
      return null;
    }

    return this.getAdminReleaseById(releaseId);
  }

  async deleteRelease(releaseId: string): Promise<boolean> {
    const result = await this.db.run(
      `
        DELETE FROM releases
        WHERE id = ?
      `,
      releaseId,
    );

    return (result.changes ?? 0) > 0;
  }

  async createEntry(
    releaseId: string,
    input: CreateEntryInput,
  ): Promise<ChangelogEntry> {
    const id = randomUUID();

    await this.db.run(
      `
        INSERT INTO changelog_entries (
          id,
          release_id,
          type,
          title,
          body,
          audience,
          impact,
          tags,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      id,
      releaseId,
      input.type,
      input.title,
      input.body ?? null,
      input.audience,
      input.impact,
      JSON.stringify(input.tags),
      input.sortOrder ?? 0,
    );

    const entry = await this.getEntryById(id);

    if (!entry) {
      throw new Error("entry_create_failed");
    }

    return entry;
  }

  async updateEntry(
    entryId: string,
    input: UpdateEntryInput,
  ): Promise<ChangelogEntry | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (input.type !== undefined) {
      assignments.push("type = ?");
      params.push(input.type);
    }

    if (input.title !== undefined) {
      assignments.push("title = ?");
      params.push(input.title);
    }

    if (input.body !== undefined) {
      assignments.push("body = ?");
      params.push(input.body ?? null);
    }

    if (input.audience !== undefined) {
      assignments.push("audience = ?");
      params.push(input.audience);
    }

    if (input.impact !== undefined) {
      assignments.push("impact = ?");
      params.push(input.impact);
    }

    if (input.tags !== undefined) {
      assignments.push("tags = ?");
      params.push(JSON.stringify(input.tags));
    }

    if (input.sortOrder !== undefined) {
      assignments.push("sort_order = ?");
      params.push(input.sortOrder);
    }

    assignments.push("updated_at = CURRENT_TIMESTAMP");

    const result = await this.db.run(
      `
        UPDATE changelog_entries
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      ...params,
      entryId,
    );

    if (!result.changes) {
      return null;
    }

    return this.getEntryById(entryId);
  }

  async deleteEntry(entryId: string): Promise<boolean> {
    const result = await this.db.run(
      `
        DELETE FROM changelog_entries
        WHERE id = ?
      `,
      entryId,
    );

    return (result.changes ?? 0) > 0;
  }

  async publishRelease(releaseId: string, releasedAt: string): Promise<ChangelogRelease | null> {
    const result = await this.db.run(
      `
        UPDATE releases
        SET
          status = 'published',
          released_at = COALESCE(released_at, ?),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      releasedAt,
      releaseId,
    );

    if (!result.changes) {
      return null;
    }

    return this.getAdminReleaseById(releaseId);
  }

  async getAdminReleaseById(releaseId: string): Promise<ChangelogRelease | null> {
    const releaseRow = await this.db.get<ReleaseRow>(
      `
        SELECT
          id,
          version,
          title,
          summary,
          status,
          released_at,
          created_at,
          updated_at
        FROM releases
        WHERE id = ?
      `,
      releaseId,
    );

    if (!releaseRow) {
      return null;
    }

    const entries = await this.listAdminEntriesForReleaseIds([releaseId]);

    return hydrateReleases([releaseRow], entries)[0] ?? null;
  }

  async getReleaseRecordById(releaseId: string): Promise<{
    readonly id: string;
    readonly version: string;
    readonly status: ReleaseStatus;
  } | null> {
    const row = await this.db.get<{
      readonly id: string;
      readonly version: string;
      readonly status: ReleaseStatus;
    }>(
      `
        SELECT id, version, status
        FROM releases
        WHERE id = ?
      `,
      releaseId,
    );

    return row ?? null;
  }

  async getReleaseRecordByVersion(version: string): Promise<{
    readonly id: string;
    readonly version: string;
    readonly status: ReleaseStatus;
  } | null> {
    const row = await this.db.get<{
      readonly id: string;
      readonly version: string;
      readonly status: ReleaseStatus;
    }>(
      `
        SELECT id, version, status
        FROM releases
        WHERE version = ?
      `,
      version,
    );

    return row ?? null;
  }

  async countEntriesForRelease(releaseId: string): Promise<number> {
    const row = await this.db.get<CountRow>(
      `
        SELECT COUNT(*) AS count
        FROM changelog_entries
        WHERE release_id = ?
      `,
      releaseId,
    );

    return row?.count ?? 0;
  }

  async getEntryById(entryId: string): Promise<ChangelogEntry | null> {
    const row = await this.db.get<EntryRow>(
      `
        SELECT
          id,
          release_id,
          type,
          title,
          body,
          audience,
          impact,
          tags,
          sort_order,
          created_at,
          updated_at
        FROM changelog_entries
        WHERE id = ?
      `,
      entryId,
    );

    return row ? mapEntryRow(row) : null;
  }

  private async listPublishedReleaseRows(
    filters: ChangelogListQuery,
    viewer: ChangelogViewerContext,
  ): Promise<readonly ReleaseRow[]> {
    const entryPredicate = buildEntryPredicate("e", filters, viewer);

    if (entryPredicate.impossible) {
      return [];
    }

    const readJoin = buildReadJoin(viewer);
    const clauses = [
      "r.status = 'published'",
      "EXISTS (SELECT 1 FROM changelog_entries e WHERE e.release_id = r.id AND " +
        entryPredicate.sql +
        ")",
    ];
    const params = [...readJoin.params];
    const whereParams = [...entryPredicate.params];

    if (filters.since) {
      clauses.push("r.released_at >= ?");
      whereParams.push(filters.since);
    }

    const rows = await this.db.all<ReleaseRow[]>(
      `
        SELECT
          r.id,
          r.version,
          r.title,
          r.summary,
          r.status,
          r.released_at,
          r.created_at,
          r.updated_at,
          ${readJoin.selectSql} AS is_read
        FROM releases r
        ${readJoin.joinSql}
        WHERE ${clauses.join(" AND ")}
        ORDER BY r.released_at DESC, r.created_at DESC
        LIMIT ?
      `,
      ...params,
      ...whereParams,
      filters.limit,
    );

    return rows;
  }

  private async listEntriesForReleaseIds(
    releaseIds: readonly string[],
    filters: ChangelogListQuery,
    viewer: ChangelogViewerContext,
  ): Promise<readonly ChangelogEntry[]> {
    if (releaseIds.length === 0) {
      return [];
    }

    const entryPredicate = buildEntryPredicate("e", filters, viewer);

    if (entryPredicate.impossible) {
      return [];
    }

    const placeholders = releaseIds.map(() => "?").join(", ");
    const rows = await this.db.all<EntryRow[]>(
      `
        SELECT
          e.id,
          e.release_id,
          e.type,
          e.title,
          e.body,
          e.audience,
          e.impact,
          e.tags,
          e.sort_order,
          e.created_at,
          e.updated_at
        FROM changelog_entries e
        WHERE e.release_id IN (${placeholders})
          AND ${entryPredicate.sql}
        ORDER BY e.release_id ASC, e.sort_order ASC, e.created_at ASC
      `,
      ...releaseIds,
      ...entryPredicate.params,
    );

    return rows.map(mapEntryRow);
  }

  private async listAdminEntriesForReleaseIds(
    releaseIds: readonly string[],
  ): Promise<readonly ChangelogEntry[]> {
    if (releaseIds.length === 0) {
      return [];
    }

    const placeholders = releaseIds.map(() => "?").join(", ");
    const rows = await this.db.all<EntryRow[]>(
      `
        SELECT
          id,
          release_id,
          type,
          title,
          body,
          audience,
          impact,
          tags,
          sort_order,
          created_at,
          updated_at
        FROM changelog_entries
        WHERE release_id IN (${placeholders})
        ORDER BY release_id ASC, sort_order ASC, created_at ASC
      `,
      ...releaseIds,
    );

    return rows.map(mapEntryRow);
  }
}

function buildEntryPredicate(
  alias: string,
  filters: Pick<ChangelogListQuery, "type" | "audience" | "tag">,
  viewer: ChangelogViewerContext,
): { readonly sql: string; readonly params: readonly unknown[]; readonly impossible: boolean } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!viewer.canViewInternal) {
    clauses.push(`${alias}.audience <> 'internal'`);
  }

  if (filters.audience) {
    if (filters.audience === "internal" && !viewer.canViewInternal) {
      return {
        sql: "1 = 0",
        params: [],
        impossible: true,
      };
    }

    clauses.push(`${alias}.audience = ?`);
    params.push(filters.audience);
  }

  if (filters.type) {
    clauses.push(`${alias}.type = ?`);
    params.push(filters.type);
  }

  if (filters.tag) {
    clauses.push(
      `EXISTS (SELECT 1 FROM json_each(${alias}.tags) changelog_tag WHERE changelog_tag.value = ?)`,
    );
    params.push(filters.tag);
  }

  return {
    sql: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1",
    params,
    impossible: false,
  };
}

function buildReadJoin(viewer: ChangelogViewerContext): {
  readonly joinSql: string;
  readonly params: readonly unknown[];
  readonly selectSql: string;
} {
  if (viewer.userId) {
    return {
      joinSql:
        "LEFT JOIN changelog_reads read_state ON read_state.release_id = r.id AND read_state.user_id = ?",
      params: [viewer.userId],
      selectSql: "CASE WHEN read_state.id IS NULL THEN 0 ELSE 1 END",
    };
  }

  if (viewer.clientId) {
    return {
      joinSql:
        "LEFT JOIN changelog_reads read_state ON read_state.release_id = r.id AND read_state.client_id = ?",
      params: [viewer.clientId],
      selectSql: "CASE WHEN read_state.id IS NULL THEN 0 ELSE 1 END",
    };
  }

  return {
    joinSql: "",
    params: [],
    selectSql: "0",
  };
}

function hydrateReleases(
  releaseRows: readonly ReleaseRow[],
  entries: readonly ChangelogEntry[],
): readonly ChangelogRelease[] {
  const entriesByReleaseId = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    const current = entriesByReleaseId.get(entry.releaseId) ?? [];
    current.push(entry);
    entriesByReleaseId.set(entry.releaseId, current);
  }

  return releaseRows.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.title,
    summary: row.summary ?? undefined,
    status: row.status,
    releasedAt: row.released_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isRead: toBoolean(row.is_read),
    entries: entriesByReleaseId.get(row.id) ?? [],
  }));
}

function mapEntryRow(row: EntryRow): ChangelogEntry {
  return {
    id: row.id,
    releaseId: row.release_id,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    audience: row.audience,
    impact: row.impact,
    tags: parseTags(row.tags),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseTags(raw: string): readonly string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  return value === "1" || value === "true";
}
