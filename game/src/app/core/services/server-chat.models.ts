import type { ServerPlayerRank } from "./server-connection.service";
export type ServerChatAccessState = "allowed" | "timed_out" | "banned";

export interface ServerInfoView {
  readonly name: string;
  readonly port: number;
  readonly defaultClientId: string;
  readonly passwordLockSupported: boolean;
}

export interface ServerPresencePlayerView {
  readonly playerUuid: string;
  readonly displayName?: string;
  readonly avatarPath?: string;
  readonly rank: ServerPlayerRank;
  readonly chatAccess: ServerChatAccessState;
  readonly chatAccessLabel: string;
  readonly chatTimeoutUntil?: string;
  readonly chatReason?: string;
  readonly serverBanned: boolean;
  readonly serverBanReason?: string;
  readonly moderatedAt?: string;
  readonly moderatedByPlayerUuid?: string;
  readonly clientId: string;
  readonly connectedAt: string;
  readonly lastSeenAt: string;
}

export interface ServerChatMessageView {
  readonly id: number;
  readonly playerUuid: string;
  readonly displayName?: string;
  readonly avatarPath?: string;
  readonly rank: ServerPlayerRank;
  readonly chatAccess: ServerChatAccessState;
  readonly chatAccessLabel: string;
  readonly chatTimeoutUntil?: string;
  readonly chatReason?: string;
  readonly serverBanned: boolean;
  readonly serverBanReason?: string;
  readonly moderatedAt?: string;
  readonly moderatedByPlayerUuid?: string;
  readonly message: string;
  readonly createdAt: string;
}

export interface ServerChatCustomEmojiView {
  readonly id: string;
  readonly shortcode: string;
  readonly name: string;
  readonly keywords: readonly string[];
  readonly src: string;
  readonly categoryId: string;
  readonly categoryName: string;
}

export interface ServerChatCommandView {
  readonly id: string;
  readonly trigger: string;
  readonly label: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

export interface ServerFooterSummaryView {
  readonly label: string;
  readonly detail: string;
  readonly onlinePlayerCount: number;
  readonly isConnected: boolean;
}

export interface ServerChatPanelView {
  readonly title: string;
  readonly subtitle: string;
  readonly endpointLabel: string;
  readonly onlinePlayerCount: number;
  readonly isConnected: boolean;
  readonly sessionRankLabel: string | null;
  readonly sessionChatAccessLabel: string | null;
}

export interface ServerModerationRequest {
  readonly targetUuid: string;
  readonly action: "timeout" | "ban" | "clear";
  readonly reason?: string;
  readonly durationMinutes?: number;
  readonly blockServerEntry?: boolean;
}

export interface ServerPresenceResponse {
  readonly server: ServerInfoView;
  readonly count: number;
  readonly players: readonly ServerPresencePlayerView[];
}

export interface ServerChatHistoryResponse {
  readonly count: number;
  readonly entries: readonly ServerChatMessageView[];
}
