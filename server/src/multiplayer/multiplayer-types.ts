export type PlayerRank = "player" | "vip" | "moderator" | "admin";
export type ChatAccessState = "allowed" | "timed_out" | "banned";

export interface PlayerModerationRecord {
  readonly chatAccess: ChatAccessState;
  readonly chatAccessLabel: string;
  readonly chatTimeoutUntil?: string;
  readonly chatReason?: string;
  readonly serverBanned: boolean;
  readonly serverBanReason?: string;
  readonly moderatedAt?: string;
  readonly moderatedByPlayerUuid?: string;
}

export interface AllowedPlayerRecord extends PlayerModerationRecord {
  readonly playerUuid: string;
  readonly displayName?: string;
  readonly avatarPath?: string;
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

export interface ChatMessageRecord extends PlayerModerationRecord {
  readonly id: number;
  readonly playerUuid: string;
  readonly displayName?: string;
  readonly avatarPath?: string;
  readonly rank: PlayerRank;
  readonly message: string;
  readonly createdAt: string;
}

export interface OnlinePlayerRecord extends PlayerModerationRecord {
  readonly playerUuid: string;
  readonly displayName?: string;
  readonly avatarPath?: string;
  readonly rank: PlayerRank;
  readonly clientId: string;
  readonly connectedAt: string;
  readonly lastSeenAt: string;
}

export interface PlayerAuditLogRecord {
  readonly id: number;
  readonly playerUuid?: string;
  readonly eventType: string;
  readonly detailsJson: string;
  readonly createdAt: string;
}
