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

export interface AdminPlayerListEntryView {
  readonly profileId: string;
  readonly profileDisplayName?: string;
  readonly currentCharacterId?: string;
  readonly currentCharacterName?: string;
  readonly online: boolean;
  readonly lastOnlineAt?: string;
}

export interface AdminProfilePermissionView {
  readonly permissionId: string;
  readonly grantedAt: string;
  readonly grantedByProfileId: string;
}

export interface AdminProfileCharacterView {
  readonly characterId: string;
  readonly name: string;
  readonly online: boolean;
  readonly guildId?: string;
  readonly guildName?: string;
  readonly role?: string;
  readonly savedProgressSummary?: unknown;
}

export interface AdminProfileNoteView {
  readonly id: string;
  readonly targetProfileId: string;
  readonly authorProfileId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminProfileDetailView {
  readonly profileId: string;
  readonly displayName?: string;
  readonly online: boolean;
  readonly lastOnlineAt?: string;
  readonly moderation: {
    readonly banned: boolean;
    readonly muted: boolean;
    readonly warned: boolean;
  };
  readonly permissions: readonly AdminProfilePermissionView[];
  readonly characters: readonly AdminProfileCharacterView[];
  readonly currentOnlineCharacterId?: string;
  readonly friendCount: number;
  readonly guildMemberships: readonly {
    guildId: string;
    guildName: string;
    role: string;
    characterId: string;
  }[];
  readonly adminNotes: readonly AdminProfileNoteView[];
}
