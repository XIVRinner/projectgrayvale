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
  readonly online: boolean;
  readonly lastOnlineAt?: string;
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
