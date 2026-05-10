export type PlayerRank = "player" | "vip" | "moderator" | "admin";

export interface AllowedPlayerRecord {
  readonly playerUuid: string;
  readonly displayName?: string;
  readonly rank: PlayerRank;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSeenAt?: string;
}

export interface ServerSessionRecord {
  readonly sessionId: string;
  readonly playerUuid: string;
  readonly clientId: string;
  readonly ipAddress?: string;
  readonly connectedAt: string;
  readonly lastSeenAt: string;
}

export interface ChatMessageRecord {
  readonly id: number;
  readonly playerUuid: string;
  readonly rank: PlayerRank;
  readonly message: string;
  readonly createdAt: string;
}

export interface PlayerAuditLogRecord {
  readonly id: number;
  readonly playerUuid?: string;
  readonly eventType: string;
  readonly detailsJson: string;
  readonly createdAt: string;
}

export const RANK_COLOR_BY_VALUE: Readonly<Record<PlayerRank, string>> = {
  player: "#d0d4f2",
  vip: "#ff9a6c",
  moderator: "#66d6ff",
  admin: "#b48aff"
};
