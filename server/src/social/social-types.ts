export type ChatChannelType =
  | "official"
  | "custom"
  | "guild"
  | "direct"
  | "admin"
  | "system";

export interface SocialBadgeDto {
  readonly type: "friend" | "guild_role" | "admin" | "moderation" | "permission";
  readonly label: string;
}

export interface SocialIdentityDto {
  readonly profileId: string;
  readonly characterId?: string;
  readonly characterName?: string;
  readonly profileDisplayName?: string;
  readonly guildShortName?: string;
  readonly online: boolean;
  readonly lastOnlineAt?: string;
  readonly badges: readonly SocialBadgeDto[];
}

export interface ChatChannelDto {
  readonly id: string;
  readonly name: string;
  readonly type: ChatChannelType;
  readonly unreadCount: number;
  readonly role?: string;
}

export interface ChatMessageDto {
  readonly id: string;
  readonly channelId: string;
  readonly channelType: ChatChannelType;
  readonly senderProfileId?: string;
  readonly senderCharacterId?: string;
  readonly senderCharacterName?: string;
  readonly body: string;
  readonly createdAt: string;
  readonly messageType: "user" | "system" | "motd" | "moderation";
  readonly sender: SocialIdentityDto;
}

export interface DirectConversationDto {
  readonly id: string;
  readonly profileAId: string;
  readonly profileBId: string;
  readonly updatedAt: string;
  readonly counterpart: SocialIdentityDto;
}

export interface PlayerPresenceDto {
  readonly profileId: string;
  readonly profileDisplayName?: string;
  readonly currentCharacterId?: string;
  readonly currentCharacterName?: string;
  readonly guildShortName?: string;
  readonly online: boolean;
  readonly lastOnlineAt?: string;
}

export interface AdminPermissionDto {
  readonly permissionId: string;
  readonly grantedAt: string;
  readonly grantedByProfileId: string;
}

export interface AdminCharacterSummaryDto {
  readonly characterId: string;
  readonly name: string;
  readonly online: boolean;
  readonly guildId?: string;
  readonly guildName?: string;
  readonly guildShortName?: string;
  readonly role?: string;
  readonly savedProgressSummary?: unknown;
}

export interface AdminProfileNoteDto {
  readonly id: string;
  readonly targetProfileId: string;
  readonly authorProfileId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminProfileDetailDto {
  readonly profileId: string;
  readonly displayName?: string;
  readonly online: boolean;
  readonly lastOnlineAt?: string;
  readonly moderation: {
    readonly banned: boolean;
    readonly muted: boolean;
    readonly warned: boolean;
  };
  readonly permissions: readonly AdminPermissionDto[];
  readonly characters: readonly AdminCharacterSummaryDto[];
  readonly currentOnlineCharacterId?: string;
  readonly friendCount: number;
  readonly guildMemberships: readonly {
    guildId: string;
    guildName: string;
    guildShortName?: string;
    role: string;
    characterId: string;
  }[];
  readonly adminNotes: readonly AdminProfileNoteDto[];
}

export interface SocialActorContext {
  readonly sessionId: string;
  readonly characterId: string;
  readonly profileId: string;
  readonly characterName?: string;
  readonly profileDisplayName?: string;
  readonly rank: "player" | "vip" | "moderator" | "admin";
  readonly chatAccess: "allowed" | "timed_out" | "banned";
  readonly chatReason?: string;
  readonly chatTimeoutUntil?: string;
}
