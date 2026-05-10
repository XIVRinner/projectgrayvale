import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { GrayvaleDatabase } from "../db/database";
import type {
  AllowedPlayerRecord,
  ChatMessageRecord,
  PlayerAuditLogRecord,
  PlayerRank,
  ServerSessionRecord
} from "./multiplayer-types";

interface AllowedPlayerRow {
  readonly player_uuid: string;
  readonly password_hash: string;
  readonly display_name: string | null;
  readonly rank: PlayerRank;
  readonly created_at: string;
  readonly updated_at: string;
  readonly last_seen_at: string | null;
}

interface SessionRow {
  readonly session_id: string;
  readonly player_uuid: string;
  readonly client_id: string;
  readonly ip_address: string | null;
  readonly connected_at: string;
  readonly last_seen_at: string;
}

interface ChatMessageRow {
  readonly id: number;
  readonly player_uuid: string;
  readonly rank: PlayerRank;
  readonly message: string;
  readonly created_at: string;
}

interface AuditLogRow {
  readonly id: number;
  readonly player_uuid: string | null;
  readonly event_type: string;
  readonly details_json: string;
  readonly created_at: string;
}

// Balance between brute-force resistance and low-latency login checks on the local dev server.
const PBKDF2_ITERATIONS = 120_000;

export class MultiplayerRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async registerPlayer(playerUuid: string, password: string, displayName?: string): Promise<AllowedPlayerRecord> {
    const existing = await this.getAllowedPlayer(playerUuid);

    if (existing) {
      throw new Error("player_exists");
    }

    const passwordHash = hashPassword(password);

    await this.db.run(
      `
        INSERT INTO allowed_players (player_uuid, password_hash, display_name, rank)
        VALUES (?, ?, ?, 'player')
      `,
      playerUuid,
      passwordHash,
      normalizeDisplayName(displayName)
    );

    const created = await this.getAllowedPlayer(playerUuid);

    if (!created) {
      throw new Error("player_create_failed");
    }

    return created;
  }

  async authenticatePlayer(playerUuid: string, password: string): Promise<AllowedPlayerRecord | null> {
    const row = await this.db.get<AllowedPlayerRow>(
      `
        SELECT
          player_uuid,
          password_hash,
          display_name,
          rank,
          created_at,
          updated_at,
          last_seen_at
        FROM allowed_players
        WHERE player_uuid = ?
      `,
      playerUuid
    );

    if (!row) {
      return null;
    }

    if (!verifyPassword(password, row.password_hash)) {
      throw new Error("invalid_password");
    }

    return mapAllowedPlayer(row);
  }

  async getAllowedPlayer(playerUuid: string): Promise<AllowedPlayerRecord | null> {
    const row = await this.db.get<AllowedPlayerRow>(
      `
        SELECT
          player_uuid,
          password_hash,
          display_name,
          rank,
          created_at,
          updated_at,
          last_seen_at
        FROM allowed_players
        WHERE player_uuid = ?
      `,
      playerUuid
    );

    return row ? mapAllowedPlayer(row) : null;
  }

  async createSession(
    playerUuid: string,
    clientId: string,
    ipAddress?: string
  ): Promise<ServerSessionRecord> {
    const sessionId = randomUUID();

    await this.db.run(
      `
        INSERT INTO server_sessions (session_id, player_uuid, client_id, ip_address)
        VALUES (?, ?, ?, ?)
      `,
      sessionId,
      playerUuid,
      clientId,
      ipAddress?.trim() || null
    );

    await this.markPlayerSeen(playerUuid);

    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error("session_create_failed");
    }

    return session;
  }

  async getSession(sessionId: string): Promise<ServerSessionRecord | null> {
    const row = await this.db.get<SessionRow>(
      `
        SELECT
          session_id,
          player_uuid,
          client_id,
          ip_address,
          connected_at,
          last_seen_at
        FROM server_sessions
        WHERE session_id = ?
      `,
      sessionId
    );

    return row ? mapSession(row) : null;
  }

  async markSessionSeen(sessionId: string): Promise<void> {
    await this.db.run(
      `
        UPDATE server_sessions
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `,
      sessionId
    );
  }

  async markPlayerSeen(playerUuid: string): Promise<void> {
    await this.db.run(
      `
        UPDATE allowed_players
        SET last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE player_uuid = ?
      `,
      playerUuid
    );
  }

  async setPlayerRank(playerUuid: string, rank: PlayerRank): Promise<AllowedPlayerRecord | null> {
    await this.db.run(
      `
        UPDATE allowed_players
        SET rank = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE player_uuid = ?
      `,
      rank,
      playerUuid
    );

    return this.getAllowedPlayer(playerUuid);
  }

  async appendAuditLog(
    eventType: string,
    details: Record<string, unknown>,
    playerUuid?: string
  ): Promise<void> {
    await this.db.run(
      `
        INSERT INTO player_audit_logs (player_uuid, event_type, details_json)
        VALUES (?, ?, ?)
      `,
      playerUuid ?? null,
      eventType,
      JSON.stringify(details)
    );
  }

  async listAuditLogs(limit = 100, playerUuid?: string): Promise<readonly PlayerAuditLogRecord[]> {
    const normalizedLimit = normalizeLimit(limit, 500);

    if (playerUuid) {
      const rows = await this.db.all<AuditLogRow[]>(
        `
          SELECT id, player_uuid, event_type, details_json, created_at
          FROM player_audit_logs
          WHERE player_uuid = ?
          ORDER BY id DESC
          LIMIT ?
        `,
        playerUuid,
        normalizedLimit
      );

      return rows.map(mapAuditLog);
    }

    const rows = await this.db.all<AuditLogRow[]>(
      `
        SELECT id, player_uuid, event_type, details_json, created_at
        FROM player_audit_logs
        ORDER BY id DESC
        LIMIT ?
      `,
      normalizedLimit
    );

    return rows.map(mapAuditLog);
  }

  async appendChatMessage(
    playerUuid: string,
    rank: PlayerRank,
    message: string
  ): Promise<ChatMessageRecord> {
    const normalizedMessage = normalizeMessage(message);

    if (!normalizedMessage) {
      throw new Error("invalid_chat_message");
    }

    const result = await this.db.run(
      `
        INSERT INTO chat_messages (player_uuid, rank, message)
        VALUES (?, ?, ?)
      `,
      playerUuid,
      rank,
      normalizedMessage
    );

    const created = await this.db.get<ChatMessageRow>(
      `
        SELECT id, player_uuid, rank, message, created_at
        FROM chat_messages
        WHERE id = ?
      `,
      result.lastID
    );

    if (!created) {
      throw new Error("chat_append_failed");
    }

    return mapChatMessage(created);
  }

  async listChatMessages(limit = 100): Promise<readonly ChatMessageRecord[]> {
    const normalizedLimit = normalizeLimit(limit, 300);
    const rows = await this.db.all<ChatMessageRow[]>(
      `
        SELECT id, player_uuid, rank, message, created_at
        FROM chat_messages
        ORDER BY id DESC
        LIMIT ?
      `,
      normalizedLimit
    );

    return rows.reverse().map(mapChatMessage);
  }
}

function mapAllowedPlayer(row: AllowedPlayerRow): AllowedPlayerRecord {
  return {
    playerUuid: row.player_uuid,
    displayName: row.display_name ?? undefined,
    rank: row.rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at ?? undefined
  };
}

function mapSession(row: SessionRow): ServerSessionRecord {
  return {
    sessionId: row.session_id,
    playerUuid: row.player_uuid,
    clientId: row.client_id,
    ipAddress: row.ip_address ?? undefined,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_seen_at
  };
}

function mapChatMessage(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    playerUuid: row.player_uuid,
    rank: row.rank,
    message: row.message,
    createdAt: row.created_at
  };
}

function mapAuditLog(row: AuditLogRow): PlayerAuditLogRecord {
  return {
    id: row.id,
    playerUuid: row.player_uuid ?? undefined,
    eventType: row.event_type,
    detailsJson: row.details_json,
    createdAt: row.created_at
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(actualHash, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function normalizeDisplayName(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 80);
}

function normalizeMessage(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, 500);
}

function normalizeLimit(value: number, max: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    return 100;
  }

  return Math.min(value, max);
}
