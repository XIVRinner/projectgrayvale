import type { ServerPlayerRank } from "./server-connection.service";
export type ServerChatAccessState = "allowed" | "timed_out" | "banned";
export type ServerChatChannelType =
  | "official"
  | "custom"
  | "guild"
  | "direct"
  | "admin"
  | "system";

export interface SocialBadgeView {
  readonly type: "friend" | "guild_role" | "admin" | "moderation" | "permission";
  readonly label: string;
}

export interface SocialIdentityView {
  readonly profileId: string;
  readonly characterId?: string;
  readonly characterName?: string;
  readonly profileDisplayName?: string;
  readonly online: boolean;
  readonly lastOnlineAt?: string;
  readonly badges: readonly SocialBadgeView[];
}

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
  readonly id: string;
  readonly channelId: string;
  readonly channelType: ServerChatChannelType;
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
  readonly sender: SocialIdentityView;
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
  readonly channels: readonly ServerChatChannelView[];
  readonly activeChannelId: string | null;
}

export interface ServerChatChannelView {
  readonly id: string;
  readonly name: string;
  readonly type: ServerChatChannelType;
  readonly unreadCount: number;
  readonly role?: string;
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

export interface ServerChatChannelsResponse {
  readonly channels: readonly ServerChatChannelView[];
}

export interface ServerDirectConversationView {
  readonly id: string;
  readonly profileAId: string;
  readonly profileBId: string;
  readonly updatedAt: string;
  readonly counterpart: SocialIdentityView;
}

export interface ServerChatPlayerActionRequest {
  readonly action:
    | "whisper"
    | "friend_character"
    | "friend_profile"
    | "guild_invite"
    | "block"
    | "report"
    | "kick"
    | "ban"
    | "mute"
    | "admin_profile";
  readonly targetProfileId: string;
  readonly targetCharacterName?: string;
}
