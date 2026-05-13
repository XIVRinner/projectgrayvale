import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type { GrayvaleDatabase } from "../db/database";
import type {
  AllowedPlayerRecord,
  ChatMessageRecord,
  OnlinePlayerRecord,
  PlayerAuditLogRecord,
  PlayerRank,
  ServerSessionRecord,
} from "./multiplayer-types";

interface AllowedPlayerRow {
  readonly player_uuid: string;
  readonly password_hash: string;
  readonly display_name: string | null;
  readonly avatar_path: string | null;
  readonly chat_timeout_until: string | null;
  readonly chat_timeout_reason: string | null;
  readonly chat_banned_at: string | null;
  readonly chat_ban_reason: string | null;
  readonly server_banned_at: string | null;
  readonly server_ban_reason: string | null;
  readonly moderated_by_player_uuid: string | null;
  readonly moderated_at: string | null;
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
  readonly display_name: string | null;
  readonly avatar_path: string | null;
  readonly chat_timeout_until: string | null;
  readonly chat_timeout_reason: string | null;
  readonly chat_banned_at: string | null;
  readonly chat_ban_reason: string | null;
  readonly server_banned_at: string | null;
  readonly server_ban_reason: string | null;
  readonly moderated_by_player_uuid: string | null;
  readonly moderated_at: string | null;
  readonly rank: PlayerRank;
  readonly message: string;
  readonly created_at: string;
}

interface OnlinePlayerRow {
  readonly player_uuid: string;
  readonly display_name: string | null;
  readonly avatar_path: string | null;
  readonly chat_timeout_until: string | null;
  readonly chat_timeout_reason: string | null;
  readonly chat_banned_at: string | null;
  readonly chat_ban_reason: string | null;
  readonly server_banned_at: string | null;
  readonly server_ban_reason: string | null;
  readonly moderated_by_player_uuid: string | null;
  readonly moderated_at: string | null;
  readonly rank: PlayerRank;
  readonly client_id: string;
  readonly connected_at: string;
  readonly last_seen_at: string;
}

interface AuditLogRow {
  readonly id: number;
  readonly player_uuid: string | null;
  readonly event_type: string;
  readonly details_json: string;
  readonly created_at: string;
}

// Baseline PBKDF2 work factor based on OWASP Password Storage guidance (2024-era), tuned for low-latency local/server auth.
const PBKDF2_ITERATIONS = 120_000;
const ONLINE_WINDOW_MINUTES = 10;

export class MultiplayerRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async registerPlayer(
    playerUuid: string,
    password: string,
    displayName?: string,
    avatarPath?: string,
  ): Promise<AllowedPlayerRecord> {
    const existing = await this.getAllowedPlayer(playerUuid);

    if (existing) {
      throw new Error("player_exists");
    }

    const passwordHash = hashPassword(password);
    const normalizedDisplayName = normalizeDisplayName(displayName);

    await this.db.run(
      `
        INSERT INTO allowed_players (player_uuid, password_hash, display_name, avatar_path, rank)
        VALUES (?, ?, ?, ?, 'player')
      `,
      playerUuid,
      passwordHash,
      normalizedDisplayName,
      normalizeAvatarPath(avatarPath),
    );

    await this.ensurePlayerProfileExists(playerUuid, normalizedDisplayName);

    const created = await this.getAllowedPlayer(playerUuid);

    if (!created) {
      throw new Error("player_create_failed");
    }

    return created;
  }

  async authenticatePlayer(
    playerUuid: string,
    password: string,
  ): Promise<AllowedPlayerRecord | null> {
    const row = await this.db.get<AllowedPlayerRow>(
      `
        SELECT
          player_uuid,
          password_hash,
          display_name,
          avatar_path,
          chat_timeout_until,
          chat_timeout_reason,
          chat_banned_at,
          chat_ban_reason,
          server_banned_at,
          server_ban_reason,
          moderated_by_player_uuid,
          moderated_at,
          rank,
          created_at,
          updated_at,
          last_seen_at
        FROM allowed_players
        WHERE player_uuid = ?
      `,
      playerUuid,
    );

    if (!row) {
      return null;
    }

    if (!verifyPassword(password, row.password_hash)) {
      throw new Error("invalid_password");
    }

    return mapAllowedPlayer(row);
  }

  async getAllowedPlayer(
    playerUuid: string,
  ): Promise<AllowedPlayerRecord | null> {
    const row = await this.db.get<AllowedPlayerRow>(
      `
        SELECT
          player_uuid,
          password_hash,
          display_name,
          avatar_path,
          chat_timeout_until,
          chat_timeout_reason,
          chat_banned_at,
          chat_ban_reason,
          server_banned_at,
          server_ban_reason,
          moderated_by_player_uuid,
          moderated_at,
          rank,
          created_at,
          updated_at,
          last_seen_at
        FROM allowed_players
        WHERE player_uuid = ?
      `,
      playerUuid,
    );

    return row ? mapAllowedPlayer(row) : null;
  }

  async createSession(
    playerUuid: string,
    clientId: string,
    ipAddress?: string,
  ): Promise<ServerSessionRecord> {
    const sessionId = randomUUID();

    await this.ensurePlayerProfileExists(playerUuid);

    await this.db.run(
      `
        INSERT INTO server_sessions (session_id, player_uuid, client_id, ip_address)
        VALUES (?, ?, ?, ?)
      `,
      sessionId,
      playerUuid,
      clientId,
      ipAddress?.trim() || null,
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
      sessionId,
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
      sessionId,
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
      playerUuid,
    );
  }

  private async ensurePlayerProfileExists(
    playerUuid: string,
    displayName?: string | null,
  ): Promise<void> {
    await this.db.run(
      `
        INSERT INTO player_profiles (id, display_name, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          display_name = COALESCE(player_profiles.display_name, excluded.display_name),
          updated_at = CURRENT_TIMESTAMP
      `,
      playerUuid,
      displayName ?? null,
    );
  }

  async syncPlayerProfile(
    playerUuid: string,
    profile: {
      readonly displayName?: string;
      readonly avatarPath?: string;
    },
  ): Promise<void> {
    const normalizedDisplayName = normalizeDisplayName(profile.displayName);
    const normalizedAvatarPath = normalizeAvatarPath(profile.avatarPath);

    if (!normalizedDisplayName && !normalizedAvatarPath) {
      return;
    }

    await this.db.run(
      `
        UPDATE allowed_players
        SET display_name = COALESCE(?, display_name),
            avatar_path = COALESCE(?, avatar_path),
            updated_at = CURRENT_TIMESTAMP
        WHERE player_uuid = ?
      `,
      normalizedDisplayName,
      normalizedAvatarPath,
      playerUuid,
    );
  }

  async setPlayerRank(
    playerUuid: string,
    rank: PlayerRank,
  ): Promise<AllowedPlayerRecord | null> {
    await this.db.run(
      `
        UPDATE allowed_players
        SET rank = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE player_uuid = ?
      `,
      rank,
      playerUuid,
    );

    return this.getAllowedPlayer(playerUuid);
  }

  async applyModeration(
    playerUuid: string,
    input:
      | {
          readonly action: "timeout";
          readonly actorPlayerUuid: string;
          readonly reason: string;
          readonly timeoutUntil: string;
        }
      | {
          readonly action: "ban";
          readonly actorPlayerUuid: string;
          readonly reason: string;
          readonly blockServerEntry: boolean;
        }
      | {
          readonly action: "clear";
          readonly actorPlayerUuid: string;
          readonly reason?: string;
        },
  ): Promise<AllowedPlayerRecord | null> {
    if (input.action === "timeout") {
      await this.db.run(
        `
          UPDATE allowed_players
          SET chat_timeout_until = ?,
              chat_timeout_reason = ?,
              chat_banned_at = NULL,
              chat_ban_reason = NULL,
              moderated_by_player_uuid = ?,
              moderated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE player_uuid = ?
        `,
        input.timeoutUntil,
        input.reason,
        input.actorPlayerUuid,
        playerUuid,
      );

      return this.getAllowedPlayer(playerUuid);
    }

    if (input.action === "ban") {
      await this.db.run(
        `
          UPDATE allowed_players
          SET chat_timeout_until = NULL,
              chat_timeout_reason = NULL,
              chat_banned_at = CURRENT_TIMESTAMP,
              chat_ban_reason = ?,
              server_banned_at = CASE
                WHEN ? = 1 THEN CURRENT_TIMESTAMP
                ELSE server_banned_at
              END,
              server_ban_reason = CASE
                WHEN ? = 1 THEN ?
                ELSE server_ban_reason
              END,
              moderated_by_player_uuid = ?,
              moderated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE player_uuid = ?
        `,
        input.reason,
        input.blockServerEntry ? 1 : 0,
        input.blockServerEntry ? 1 : 0,
        input.reason,
        input.actorPlayerUuid,
        playerUuid,
      );

      if (input.blockServerEntry) {
        await this.deleteSessionsForPlayer(playerUuid);
      }

      return this.getAllowedPlayer(playerUuid);
    }

    await this.db.run(
      `
        UPDATE allowed_players
        SET chat_timeout_until = NULL,
            chat_timeout_reason = NULL,
            chat_banned_at = NULL,
            chat_ban_reason = NULL,
            server_banned_at = NULL,
            server_ban_reason = NULL,
            moderated_by_player_uuid = ?,
            moderated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE player_uuid = ?
      `,
      input.actorPlayerUuid,
      playerUuid,
    );
    return this.getAllowedPlayer(playerUuid);
  }

  async deleteSessionsForPlayer(playerUuid: string): Promise<void> {
    await this.db.run(
      `
        DELETE FROM server_sessions
        WHERE player_uuid = ?
      `,
      playerUuid,
    );
  }

  async appendAuditLog(
    eventType: string,
    details: Record<string, unknown>,
    playerUuid?: string,
  ): Promise<void> {
    await this.db.run(
      `
        INSERT INTO player_audit_logs (player_uuid, event_type, details_json)
        VALUES (?, ?, ?)
      `,
      playerUuid ?? null,
      eventType,
      JSON.stringify(details),
    );
  }

  async listAuditLogs(
    limit = 100,
    playerUuid?: string,
  ): Promise<readonly PlayerAuditLogRecord[]> {
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
        normalizedLimit,
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
      normalizedLimit,
    );

    return rows.map(mapAuditLog);
  }

  async appendChatMessage(
    playerUuid: string,
    rank: PlayerRank,
    message: string,
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
      normalizedMessage,
    );

    const created = await this.db.get<ChatMessageRow>(
      `
        SELECT
          chat_messages.id,
          chat_messages.player_uuid,
          allowed_players.display_name,
          allowed_players.avatar_path,
          allowed_players.chat_timeout_until,
          allowed_players.chat_timeout_reason,
          allowed_players.chat_banned_at,
          allowed_players.chat_ban_reason,
          allowed_players.server_banned_at,
          allowed_players.server_ban_reason,
          allowed_players.moderated_by_player_uuid,
          allowed_players.moderated_at,
          chat_messages.rank,
          chat_messages.message,
          chat_messages.created_at
        FROM chat_messages
        LEFT JOIN allowed_players
          ON allowed_players.player_uuid = chat_messages.player_uuid
        WHERE chat_messages.id = ?
      `,
      result.lastID,
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
        SELECT
          chat_messages.id,
          chat_messages.player_uuid,
          allowed_players.display_name,
          allowed_players.avatar_path,
          allowed_players.chat_timeout_until,
          allowed_players.chat_timeout_reason,
          allowed_players.chat_banned_at,
          allowed_players.chat_ban_reason,
          allowed_players.server_banned_at,
          allowed_players.server_ban_reason,
          allowed_players.moderated_by_player_uuid,
          allowed_players.moderated_at,
          chat_messages.rank,
          chat_messages.message,
          chat_messages.created_at
        FROM chat_messages
        LEFT JOIN allowed_players
          ON allowed_players.player_uuid = chat_messages.player_uuid
        ORDER BY id DESC
        LIMIT ?
      `,
      normalizedLimit,
    );

    return rows.reverse().map(mapChatMessage);
  }

  async listOnlinePlayers(limit = 100): Promise<readonly OnlinePlayerRecord[]> {
    const normalizedLimit = normalizeLimit(limit, 200);
    const rows = await this.db.all<OnlinePlayerRow[]>(
      `
        SELECT
          ranked.player_uuid,
          allowed_players.display_name,
          allowed_players.avatar_path,
          allowed_players.chat_timeout_until,
          allowed_players.chat_timeout_reason,
          allowed_players.chat_banned_at,
          allowed_players.chat_ban_reason,
          allowed_players.server_banned_at,
          allowed_players.server_ban_reason,
          allowed_players.moderated_by_player_uuid,
          allowed_players.moderated_at,
          allowed_players.rank,
          ranked.client_id,
          ranked.connected_at,
          ranked.last_seen_at
        FROM (
          SELECT
            server_sessions.player_uuid,
            server_sessions.client_id,
            server_sessions.connected_at,
            server_sessions.last_seen_at,
            ROW_NUMBER() OVER (
              PARTITION BY server_sessions.player_uuid
              ORDER BY
                datetime(server_sessions.last_seen_at) DESC,
                datetime(server_sessions.connected_at) DESC,
                server_sessions.session_id DESC
            ) AS row_num
          FROM server_sessions
          WHERE datetime(server_sessions.last_seen_at) >= datetime('now', ?)
        ) AS ranked
        INNER JOIN allowed_players
          ON allowed_players.player_uuid = ranked.player_uuid
        WHERE ranked.row_num = 1
        ORDER BY
          datetime(ranked.last_seen_at) DESC,
          datetime(ranked.connected_at) DESC
        LIMIT ?
      `,
      `-${ONLINE_WINDOW_MINUTES} minutes`,
      normalizedLimit,
    );

    return rows.map(mapOnlinePlayer);
  }
}

function mapAllowedPlayer(row: AllowedPlayerRow): AllowedPlayerRecord {
  return {
    playerUuid: row.player_uuid,
    displayName: row.display_name ?? undefined,
    avatarPath: row.avatar_path ?? undefined,
    ...mapModeration(row),
    rank: row.rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at ?? undefined,
  };
}

function mapSession(row: SessionRow): ServerSessionRecord {
  return {
    sessionId: row.session_id,
    playerUuid: row.player_uuid,
    clientId: row.client_id,
    ipAddress: row.ip_address ?? undefined,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapChatMessage(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    playerUuid: row.player_uuid,
    displayName: row.display_name ?? undefined,
    avatarPath: row.avatar_path ?? undefined,
    ...mapModeration(row),
    rank: row.rank,
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapOnlinePlayer(row: OnlinePlayerRow): OnlinePlayerRecord {
  return {
    playerUuid: row.player_uuid,
    displayName: row.display_name ?? undefined,
    avatarPath: row.avatar_path ?? undefined,
    ...mapModeration(row),
    rank: row.rank,
    clientId: row.client_id,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapModeration(
  row:
    | AllowedPlayerRow
    | ChatMessageRow
    | OnlinePlayerRow,
): {
  readonly chatAccess: "allowed" | "timed_out" | "banned";
  readonly chatAccessLabel: string;
  readonly chatTimeoutUntil?: string;
  readonly chatReason?: string;
  readonly serverBanned: boolean;
  readonly serverBanReason?: string;
  readonly moderatedAt?: string;
  readonly moderatedByPlayerUuid?: string;
} {
  const activeTimeoutUntil = resolveActiveTimeout(row.chat_timeout_until);
  const chatReason = row.chat_ban_reason ?? row.chat_timeout_reason ?? undefined;
  const serverBanned = Boolean(row.server_banned_at);
  const serverBanReason = row.server_ban_reason ?? undefined;

  if (row.chat_banned_at) {
    return {
      chatAccess: "banned",
      chatAccessLabel: serverBanned ? "Chat Banned | Server Banned" : "Chat Banned",
      chatReason,
      serverBanned,
      serverBanReason,
      moderatedAt: row.moderated_at ?? undefined,
      moderatedByPlayerUuid: row.moderated_by_player_uuid ?? undefined,
    };
  }

  if (activeTimeoutUntil) {
    return {
      chatAccess: "timed_out",
      chatAccessLabel: "Timed Out",
      chatTimeoutUntil: activeTimeoutUntil,
      chatReason,
      serverBanned,
      serverBanReason,
      moderatedAt: row.moderated_at ?? undefined,
      moderatedByPlayerUuid: row.moderated_by_player_uuid ?? undefined,
    };
  }

  return {
    chatAccess: "allowed",
    chatAccessLabel: "Chat Open",
    serverBanned,
    serverBanReason,
    moderatedAt: row.moderated_at ?? undefined,
    moderatedByPlayerUuid: row.moderated_by_player_uuid ?? undefined,
  };
}

function mapAuditLog(row: AuditLogRow): PlayerAuditLogRecord {
  return {
    id: row.id,
    playerUuid: row.player_uuid ?? undefined,
    eventType: row.event_type,
    detailsJson: row.details_json,
    createdAt: row.created_at,
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    64,
    "sha512",
  ).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    64,
    "sha512",
  ).toString("hex");

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

function normalizeAvatarPath(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 300);
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

function resolveActiveTimeout(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const timeoutDate = Date.parse(value);

  if (Number.isNaN(timeoutDate)) {
    return undefined;
  }

  return timeoutDate > Date.now() ? value : undefined;
}
