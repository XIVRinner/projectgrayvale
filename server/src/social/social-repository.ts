import { randomUUID } from "node:crypto";

import type { GrayvaleDatabase } from "../db/database";
import type {
  AdminCharacterSummaryDto,
  AdminPermissionDto,
  AdminProfileDetailDto,
  AdminProfileNoteDto,
  ChatChannelDto,
  ChatChannelType,
  ChatMessageDto,
  DirectConversationDto,
  PlayerPresenceDto,
  SocialActorContext,
  SocialBadgeDto,
  SocialIdentityDto,
} from "./social-types";

const RESERVED_CHANNEL_NAMES = new Set([
  "world",
  "help",
  "guild",
  "admin",
  "system",
  "official",
  "direct",
  "dm",
  "whisper",
  "tell",
  "server",
]);

const GRANTABLE_PROFILE_PERMISSIONS = new Set([
  "admin_panel",
  "can_create_custom_channels",
  "can_invite_guild",
  "can_moderate_chat",
  "can_priority_reports",
]);

interface SessionActorRow {
  readonly session_id: string;
  readonly character_id: string;
  readonly profile_id: string | null;
  readonly character_name: string | null;
  readonly profile_display_name: string | null;
  readonly allowed_display_name: string | null;
  readonly rank: "player" | "vip" | "moderator" | "admin";
  readonly chat_timeout_until: string | null;
  readonly chat_timeout_reason: string | null;
  readonly chat_banned_at: string | null;
  readonly chat_ban_reason: string | null;
}

interface ChannelRow {
  readonly id: string;
  readonly name: string;
  readonly type: ChatChannelType;
  readonly owner_profile_id: string | null;
  readonly guild_id: string | null;
  readonly destroyed_at?: string | null;
}

interface ChannelMemberRow {
  readonly channel_id: string;
  readonly profile_id: string;
  readonly role: string;
  readonly banned: number;
}

interface MessageRow {
  readonly id: string;
  readonly channel_id: string;
  readonly channel_type: ChatChannelType;
  readonly sender_profile_id: string | null;
  readonly sender_character_id: string | null;
  readonly sender_character_name: string | null;
  readonly body: string;
  readonly message_type: "user" | "system" | "motd" | "moderation";
  readonly created_at: string;
}

interface PresenceRow {
  readonly profile_id: string;
  readonly profile_display_name: string | null;
  readonly current_character_id: string | null;
  readonly current_character_name: string | null;
  readonly guild_short_name: string | null;
  readonly online: number;
  readonly last_online_at: string | null;
}

interface DirectConversationRow {
  readonly id: string;
  readonly profile_a_id: string;
  readonly profile_b_id: string;
  readonly updated_at: string;
}

interface DirectMessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_profile_id: string;
  readonly sender_character_id: string | null;
  readonly sender_character_name: string | null;
  readonly body: string;
  readonly created_at: string;
}

export class SocialRepository {
  constructor(private readonly db: GrayvaleDatabase) {}

  async ensureOfficialChannels(): Promise<void> {
    await this.ensureChannel("world", "official");
    await this.ensureChannel("help", "official");
  }

  async resolveActorBySession(sessionId: string): Promise<SocialActorContext | null> {
    const row = await this.db.get<SessionActorRow>(
      `
        SELECT
          server_sessions.session_id,
          server_sessions.player_uuid AS character_id,
          player_characters.profile_id,
          player_characters.name AS character_name,
          player_profiles.display_name AS profile_display_name,
          allowed_players.display_name AS allowed_display_name,
          allowed_players.rank,
          allowed_players.chat_timeout_until,
          allowed_players.chat_timeout_reason,
          allowed_players.chat_banned_at,
          allowed_players.chat_ban_reason
        FROM server_sessions
        INNER JOIN allowed_players
          ON allowed_players.player_uuid = server_sessions.player_uuid
        LEFT JOIN player_characters
          ON player_characters.id = server_sessions.player_uuid
        LEFT JOIN player_profiles
          ON player_profiles.id = player_characters.profile_id
        WHERE server_sessions.session_id = ?
      `,
      sessionId,
    );

    if (!row) {
      return null;
    }

    const profileId = row.profile_id ?? row.character_id;
    const characterName =
      row.character_name ?? row.allowed_display_name ?? row.profile_display_name ?? undefined;
    const profileDisplayName =
      row.profile_display_name ?? row.allowed_display_name ?? undefined;

    await this.ensureProfileExists(profileId);
    await this.ensureCharacterExists(row.character_id, profileId, characterName);
    const chatAccess =
      row.chat_banned_at
        ? "banned"
        : resolveActiveTimeout(row.chat_timeout_until)
          ? "timed_out"
          : "allowed";

    return {
      sessionId: row.session_id,
      characterId: row.character_id,
      profileId,
      characterName,
      profileDisplayName,
      rank: row.rank,
      chatAccess,
      chatReason: row.chat_ban_reason ?? row.chat_timeout_reason ?? undefined,
      chatTimeoutUntil: resolveActiveTimeout(row.chat_timeout_until) ?? undefined,
    };
  }

  async refreshPresenceFromSessions(activeWindowMinutes = 10): Promise<void> {
    await this.db.exec(`
      UPDATE player_presence
      SET online = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE online = 1
    `);

    await this.db.run(
      `
        INSERT INTO player_profiles (id, display_name, created_at, updated_at)
        SELECT
          COALESCE(player_characters.profile_id, server_sessions.player_uuid) AS profile_id,
          COALESCE(resolved_profiles.display_name, allowed_players.display_name) AS display_name,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM server_sessions
        INNER JOIN allowed_players
          ON allowed_players.player_uuid = server_sessions.player_uuid
        LEFT JOIN player_characters
          ON player_characters.id = server_sessions.player_uuid
        LEFT JOIN player_profiles resolved_profiles
          ON resolved_profiles.id = COALESCE(player_characters.profile_id, server_sessions.player_uuid)
        WHERE datetime(server_sessions.last_seen_at) >= datetime('now', ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = COALESCE(player_profiles.display_name, excluded.display_name),
          updated_at = CURRENT_TIMESTAMP
      `,
      `-${activeWindowMinutes} minutes`,
    );

    const onlineRows = await this.db.all<
      Array<{
        profile_id: string;
        character_id: string | null;
        character_name: string | null;
        profile_display_name: string | null;
      }>
    >(
      `
        SELECT
          COALESCE(player_characters.profile_id, server_sessions.player_uuid) AS profile_id,
          player_characters.id AS character_id,
          COALESCE(player_characters.name, allowed_players.display_name) AS character_name,
          COALESCE(resolved_profiles.display_name, allowed_players.display_name) AS profile_display_name
        FROM server_sessions
        INNER JOIN allowed_players
          ON allowed_players.player_uuid = server_sessions.player_uuid
        LEFT JOIN player_characters
          ON player_characters.id = server_sessions.player_uuid
        LEFT JOIN player_profiles resolved_profiles
          ON resolved_profiles.id = COALESCE(player_characters.profile_id, server_sessions.player_uuid)
        WHERE datetime(server_sessions.last_seen_at) >= datetime('now', ?)
      `,
      `-${activeWindowMinutes} minutes`,
    );

    for (const row of onlineRows) {
      await this.db.run(
        `
          INSERT INTO player_presence (
            profile_id,
            profile_display_name,
            current_character_id,
            current_character_name,
            online,
            last_online_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(profile_id) DO UPDATE SET
            profile_display_name = COALESCE(excluded.profile_display_name, player_presence.profile_display_name),
            current_character_id = excluded.current_character_id,
            current_character_name = excluded.current_character_name,
            online = 1,
            last_online_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `,
        row.profile_id,
        row.profile_display_name,
        row.character_id,
        row.character_name,
      );
    }
  }

  async listChannelsForActor(actor: SocialActorContext): Promise<readonly ChatChannelDto[]> {
    await this.ensureOfficialChannels();
    const channels: ChatChannelDto[] = [];

    const officialRows = await this.db.all<ChannelRow[]>(
      `
        SELECT id, name, type, owner_profile_id, guild_id
        FROM chat_channels_v2
        WHERE type = 'official'
        ORDER BY CASE WHEN name = 'world' THEN 0 WHEN name = 'help' THEN 1 ELSE 2 END, name ASC
      `,
    );

    for (const row of officialRows) {
      channels.push({
        id: row.id,
        name: row.name,
        type: row.type,
        unreadCount: 0,
      });
    }

    const customRows = await this.db.all<
      Array<{ id: string; name: string; type: ChatChannelType; role: string }>
    >(
      `
        SELECT
          chat_channels_v2.id,
          chat_channels_v2.name,
          chat_channels_v2.type,
          chat_channel_members_v2.role
        FROM chat_channels_v2
        INNER JOIN chat_channel_members_v2
          ON chat_channel_members_v2.channel_id = chat_channels_v2.id
        WHERE chat_channels_v2.type = 'custom'
          AND chat_channels_v2.destroyed_at IS NULL
          AND chat_channel_members_v2.profile_id = ?
          AND chat_channel_members_v2.banned = 0
        ORDER BY chat_channels_v2.updated_at DESC
      `,
      actor.profileId,
    );

    for (const row of customRows) {
      channels.push({
        id: row.id,
        name: row.name,
        type: row.type,
        unreadCount: 0,
        role: row.role,
      });
    }

    const guildMembership = await this.db.get<{ guild_id: string; guild_name: string }>(
      `
        SELECT guild_members.guild_id, guilds.name AS guild_name
        FROM guild_members
        INNER JOIN guilds ON guilds.id = guild_members.guild_id
        WHERE guild_members.character_id = ?
      `,
      actor.characterId,
    );

    if (guildMembership) {
      const guildChannel = await this.ensureGuildChannel(
        guildMembership.guild_id,
        guildMembership.guild_name,
      );
      channels.push({
        id: guildChannel.id,
        name: guildChannel.name,
        type: "guild",
        unreadCount: 0,
      });
    }

    const directRows = await this.db.all<DirectConversationRow[]>(
      `
        SELECT id, profile_a_id, profile_b_id, updated_at
        FROM direct_conversations
        WHERE profile_a_id = ? OR profile_b_id = ?
        ORDER BY datetime(updated_at) DESC
      `,
      actor.profileId,
      actor.profileId,
    );

    for (const row of directRows) {
      const counterpartProfileId =
        row.profile_a_id === actor.profileId ? row.profile_b_id : row.profile_a_id;
      const counterpart = await this.getIdentity(counterpartProfileId, undefined, actor.profileId);
      channels.push({
        id: row.id,
        name: counterpart.characterName ?? counterpart.profileDisplayName ?? "Direct",
        type: "direct",
        unreadCount: 0,
      });
    }

    if (actor.rank === "admin") {
      const adminChannel = await this.ensureChannel("admin", "admin");
      channels.push({
        id: adminChannel.id,
        name: adminChannel.name,
        type: "admin",
        unreadCount: 0,
      });
    }

    const systemChannel = await this.ensureChannel("system", "system");
    channels.push({
      id: systemChannel.id,
      name: systemChannel.name,
      type: "system",
      unreadCount: 0,
    });

    return channels;
  }

  async joinCustomChannel(
    actor: SocialActorContext,
    name: string,
  ): Promise<{ channel: ChatChannelDto; created: boolean }> {
    const normalized = normalizeChannelName(name);
    validateCustomChannelName(normalized);

    const existing = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id, destroyed_at
        FROM chat_channels_v2
        WHERE lower(name) = lower(?)
          AND type = 'custom'
      `,
      normalized,
    );

    let created = false;
    let channel = existing
      ? existing
      : await this.createChannel(normalized, "custom", actor.profileId);

    if (!existing) {
      created = true;
    } else if (existing.destroyed_at) {
      await this.db.run(
        `
          UPDATE chat_channels_v2
          SET destroyed_at = NULL,
              owner_profile_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        actor.profileId,
        existing.id,
      );
      await this.db.run(
        `
          DELETE FROM chat_channel_members_v2
          WHERE channel_id = ?
        `,
        existing.id,
      );
      channel = {
        ...existing,
        owner_profile_id: actor.profileId,
        destroyed_at: null,
      };
      created = true;
    }

    const member = await this.db.get<ChannelMemberRow>(
      `
        SELECT channel_id, profile_id, role, banned
        FROM chat_channel_members_v2
        WHERE channel_id = ? AND profile_id = ?
      `,
      channel.id,
      actor.profileId,
    );

    if (member?.banned) {
      throw new Error("channel_banned");
    }

    if (!member) {
      await this.db.run(
        `
          INSERT INTO chat_channel_members_v2 (
            channel_id,
            profile_id,
            role,
            banned,
            joined_at
          )
          VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
        `,
        channel.id,
        actor.profileId,
        created ? "owner" : "member",
      );
    } else if (member.banned === 0) {
      await this.db.run(
        `
          UPDATE chat_channel_members_v2
          SET joined_at = CURRENT_TIMESTAMP
          WHERE channel_id = ? AND profile_id = ?
        `,
        channel.id,
        actor.profileId,
      );
    }

    return {
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        unreadCount: 0,
        role: created ? "owner" : member?.role ?? "member",
      },
      created,
    };
  }

  async leaveCustomChannel(actor: SocialActorContext, channelId: string): Promise<void> {
    const channel = await this.getChannelById(channelId);

    if (!channel) {
      throw new Error("channel_not_found");
    }

    if (channel.type !== "custom") {
      throw new Error("channel_leave_not_allowed");
    }

    const member = await this.requireMember(channel.id, actor.profileId);

    if (member.role === "owner") {
      const activeMembers = await this.db.get<{ count: number }>(
        `
          SELECT COUNT(*) AS count
          FROM chat_channel_members_v2
          WHERE channel_id = ?
            AND banned = 0
        `,
        channel.id,
      );

      if ((activeMembers?.count ?? 0) <= 1) {
        await this.destroyCustomChannel(actor, channel.id);
        return;
      }

      throw new Error("owner_cannot_leave");
    }

    await this.db.run(
      `
        DELETE FROM chat_channel_members_v2
        WHERE channel_id = ? AND profile_id = ?
      `,
      channel.id,
      actor.profileId,
    );
  }

  async destroyCustomChannel(actor: SocialActorContext, channelId: string): Promise<void> {
    const channel = await this.getChannelById(channelId);

    if (!channel) {
      throw new Error("channel_not_found");
    }

    if (channel.type !== "custom") {
      throw new Error("channel_destroy_not_allowed");
    }

    const member = await this.requireMember(channel.id, actor.profileId);
    if (member.role !== "owner") {
      throw new Error("forbidden");
    }

    await this.db.run(
      `
        UPDATE chat_channels_v2
        SET destroyed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      channel.id,
    );

    await this.db.run(
      `
        DELETE FROM chat_channel_members_v2
        WHERE channel_id = ?
      `,
      channel.id,
    );
  }

  async transferOwner(
    actor: SocialActorContext,
    channelId: string,
    targetProfileId: string,
  ): Promise<void> {
    const channel = await this.getChannelById(channelId);

    if (!channel || channel.type !== "custom") {
      throw new Error("channel_not_found");
    }

    const ownerMember = await this.requireMember(channel.id, actor.profileId);

    if (ownerMember.role !== "owner") {
      throw new Error("forbidden");
    }

    await this.requireMember(channel.id, targetProfileId);

    await this.db.run(
      `
        UPDATE chat_channel_members_v2
        SET role = CASE WHEN profile_id = ? THEN 'owner' ELSE 'member' END
        WHERE channel_id = ?
          AND profile_id IN (?, ?)
      `,
      targetProfileId,
      channel.id,
      actor.profileId,
      targetProfileId,
    );
  }

  async kickMember(
    actor: SocialActorContext,
    channelId: string,
    targetProfileId: string,
    ban: boolean,
  ): Promise<void> {
    const channel = await this.getChannelById(channelId);

    if (!channel || channel.type !== "custom") {
      throw new Error("channel_not_found");
    }

    const actorMember = await this.requireMember(channel.id, actor.profileId);

    if (actorMember.role !== "owner") {
      throw new Error("forbidden");
    }

    if (targetProfileId === actor.profileId) {
      throw new Error("cannot_target_self");
    }

    if (ban) {
      await this.db.run(
        `
          INSERT INTO chat_channel_members_v2 (
            channel_id,
            profile_id,
            role,
            banned,
            joined_at
          )
          VALUES (?, ?, 'member', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(channel_id, profile_id) DO UPDATE SET
            role = 'member',
            banned = 1
        `,
        channel.id,
        targetProfileId,
      );
      return;
    }

    await this.db.run(
      `
        DELETE FROM chat_channel_members_v2
        WHERE channel_id = ? AND profile_id = ?
      `,
      channel.id,
      targetProfileId,
    );
  }

  async unbanMember(
    actor: SocialActorContext,
    channelId: string,
    targetProfileId: string,
  ): Promise<void> {
    const channel = await this.getChannelById(channelId);

    if (!channel || channel.type !== "custom") {
      throw new Error("channel_not_found");
    }

    const actorMember = await this.requireMember(channel.id, actor.profileId);

    if (actorMember.role !== "owner") {
      throw new Error("forbidden");
    }

    await this.db.run(
      `
        UPDATE chat_channel_members_v2
        SET banned = 0
        WHERE channel_id = ? AND profile_id = ?
      `,
      channel.id,
      targetProfileId,
    );
  }

  async listChannelMessages(
    actor: SocialActorContext,
    channelId: string,
    after?: string,
    limit = 50,
  ): Promise<readonly ChatMessageDto[]> {
    const channel = await this.getChannelById(channelId);

    if (!channel) {
      throw new Error("channel_not_found");
    }

    await this.ensureChannelVisibleToActor(actor, channel);
    const normalizedLimit = normalizeLimit(limit, 100);

    let afterCreatedAt: string | undefined;

    if (after) {
      if (looksLikeIsoTimestamp(after)) {
        afterCreatedAt = after;
      } else {
        const afterRow = await this.db.get<{ created_at: string }>(
          `
            SELECT created_at
            FROM chat_messages_v2
            WHERE id = ? AND channel_id = ?
          `,
          after,
          channel.id,
        );
        afterCreatedAt = afterRow?.created_at;
      }
    }

    const rows = await this.db.all<MessageRow[]>(
      `
        SELECT
          chat_messages_v2.id,
          chat_messages_v2.channel_id,
          chat_channels_v2.type AS channel_type,
          chat_messages_v2.sender_profile_id,
          chat_messages_v2.sender_character_id,
          chat_messages_v2.sender_character_name,
          chat_messages_v2.body,
          chat_messages_v2.message_type,
          chat_messages_v2.created_at
        FROM chat_messages_v2
        INNER JOIN chat_channels_v2
          ON chat_channels_v2.id = chat_messages_v2.channel_id
        WHERE chat_messages_v2.channel_id = ?
          AND (? IS NULL OR datetime(chat_messages_v2.created_at) > datetime(?))
        ORDER BY datetime(chat_messages_v2.created_at) ASC
        LIMIT ?
      `,
      channel.id,
      afterCreatedAt ?? null,
      afterCreatedAt ?? null,
      normalizedLimit,
    );

    const messages: ChatMessageDto[] = [];

    for (const row of rows) {
      const sender = row.sender_profile_id
        ? await this.getIdentity(
            row.sender_profile_id,
            row.sender_character_id ?? undefined,
            actor.profileId,
          )
        : buildSystemIdentity();
      messages.push({
        id: row.id,
        channelId: row.channel_id,
        channelType: row.channel_type,
        senderProfileId: row.sender_profile_id ?? undefined,
        senderCharacterId: row.sender_character_id ?? undefined,
        senderCharacterName: row.sender_character_name ?? undefined,
        body: row.body,
        createdAt: row.created_at,
        messageType: row.message_type,
        sender,
      });
    }

    if (channel.type === "system") {
      const systemEntries = await this.listSystemMessagesForActor(actor, normalizedLimit);
      messages.push(...systemEntries);
      messages.sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
      return messages.slice(-normalizedLimit);
    }

    return messages;
  }

  async appendChannelMessage(
    actor: SocialActorContext,
    channelId: string,
    body: string,
    messageType: "user" | "system" | "motd" | "moderation" = "user",
  ): Promise<ChatMessageDto> {
    const channel = await this.getChannelById(channelId);

    if (!channel) {
      throw new Error("channel_not_found");
    }

    if (channel.type === "system" && messageType === "user") {
      throw new Error("read_only_channel");
    }

    await this.ensureChannelVisibleToActor(actor, channel, true);
    const normalizedBody = normalizeBody(body);

    if (!normalizedBody) {
      throw new Error("invalid_chat_message");
    }

    if (await this.isProfileMuted(actor.profileId)) {
      throw new Error("chat_blocked");
    }

    if (actor.chatAccess !== "allowed" && messageType === "user") {
      throw new Error("chat_blocked");
    }

    const id = randomUUID();

    await this.db.run(
      `
        INSERT INTO chat_messages_v2 (
          id,
          channel_id,
          sender_profile_id,
          sender_character_id,
          sender_character_name,
          body,
          message_type,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      id,
      channel.id,
      actor.profileId,
      actor.characterId,
      actor.characterName ?? actor.profileDisplayName ?? null,
      normalizedBody,
      messageType,
    );

    await this.db.run(
      `
        UPDATE chat_channels_v2
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      channel.id,
    );

    const sender = await this.getIdentity(actor.profileId, actor.characterId, actor.profileId);
    const created = await this.db.get<MessageRow>(
      `
        SELECT
          chat_messages_v2.id,
          chat_messages_v2.channel_id,
          chat_channels_v2.type AS channel_type,
          chat_messages_v2.sender_profile_id,
          chat_messages_v2.sender_character_id,
          chat_messages_v2.sender_character_name,
          chat_messages_v2.body,
          chat_messages_v2.message_type,
          chat_messages_v2.created_at
        FROM chat_messages_v2
        INNER JOIN chat_channels_v2
          ON chat_channels_v2.id = chat_messages_v2.channel_id
        WHERE chat_messages_v2.id = ?
      `,
      id,
    );

    if (!created) {
      throw new Error("chat_append_failed");
    }

    return {
      id: created.id,
      channelId: created.channel_id,
      channelType: created.channel_type,
      senderProfileId: created.sender_profile_id ?? undefined,
      senderCharacterId: created.sender_character_id ?? undefined,
      senderCharacterName: created.sender_character_name ?? undefined,
      body: created.body,
      createdAt: created.created_at,
      messageType: created.message_type,
      sender,
    };
  }

  async sendWhisper(
    actor: SocialActorContext,
    targetCharacterName: string,
    body: string,
  ): Promise<{ conversationId: string; message: ChatMessageDto }> {
    const target = await this.db.get<
      { profile_id: string; character_id: string; character_name: string }
    >(
      `
        SELECT
          profile_id,
          id AS character_id,
          name AS character_name
        FROM player_characters
        WHERE lower(name) = lower(?)
        LIMIT 1
      `,
      targetCharacterName.trim(),
    );

    if (!target) {
      throw new Error("target_not_found");
    }

    if (target.profile_id === actor.profileId) {
      throw new Error("cannot_whisper_self");
    }

    const conversation = await this.ensureDirectConversation(
      actor.profileId,
      target.profile_id,
    );
    return this.appendDirectMessage(actor, conversation, target.profile_id, body);
  }

  async openDirectConversation(
    actor: SocialActorContext,
    targetProfileId: string,
  ): Promise<{ conversationId: string }> {
    if (targetProfileId === actor.profileId) {
      throw new Error("cannot_whisper_self");
    }

    const target = await this.db.get<{ id: string }>(
      `
        SELECT id
        FROM player_profiles
        WHERE id = ?
      `,
      targetProfileId,
    );

    if (!target) {
      throw new Error("target_not_found");
    }

    const conversation = await this.ensureDirectConversation(
      actor.profileId,
      targetProfileId,
    );

    return {
      conversationId: conversation.id,
    };
  }

  async sendDirectConversationMessage(
    actor: SocialActorContext,
    conversationId: string,
    body: string,
  ): Promise<{ conversationId: string; message: ChatMessageDto }> {
    const conversation = await this.getDirectConversation(conversationId);

    if (!conversation) {
      throw new Error("conversation_not_found");
    }

    if (
      conversation.profile_a_id !== actor.profileId &&
      conversation.profile_b_id !== actor.profileId
    ) {
      throw new Error("forbidden");
    }

    const targetProfileId =
      conversation.profile_a_id === actor.profileId
        ? conversation.profile_b_id
        : conversation.profile_a_id;

    return this.appendDirectMessage(actor, conversation, targetProfileId, body);
  }

  async getGuildShortNameByCharacterId(characterId: string): Promise<string | null> {
    const row = await this.db.get<{ short_name: string | null }>(
      `
        SELECT guilds.short_name
        FROM guild_members
        INNER JOIN guilds ON guilds.id = guild_members.guild_id
        WHERE guild_members.character_id = ?
        LIMIT 1
      `,
      characterId,
    );

    return row?.short_name ?? null;
  }

  async isChannelReadOnly(channelId: string): Promise<boolean> {
    const channel = await this.getChannelById(channelId);
    return channel?.type === "system";
  }

  async listDirectConversations(actor: SocialActorContext): Promise<readonly DirectConversationDto[]> {
    const rows = await this.db.all<DirectConversationRow[]>(
      `
        SELECT id, profile_a_id, profile_b_id, updated_at
        FROM direct_conversations
        WHERE profile_a_id = ? OR profile_b_id = ?
        ORDER BY datetime(updated_at) DESC
      `,
      actor.profileId,
      actor.profileId,
    );

    const conversations: DirectConversationDto[] = [];

    for (const row of rows) {
      const counterpartId =
        row.profile_a_id === actor.profileId ? row.profile_b_id : row.profile_a_id;
      const counterpart = await this.getIdentity(counterpartId, undefined, actor.profileId);
      conversations.push({
        id: row.id,
        profileAId: row.profile_a_id,
        profileBId: row.profile_b_id,
        updatedAt: row.updated_at,
        counterpart,
      });
    }

    return conversations;
  }

  async listDirectMessages(
    actor: SocialActorContext,
    conversationId: string,
    after?: string,
    limit = 50,
  ): Promise<readonly ChatMessageDto[]> {
    const conversation = await this.db.get<DirectConversationRow>(
      `
        SELECT id, profile_a_id, profile_b_id, updated_at
        FROM direct_conversations
        WHERE id = ?
      `,
      conversationId,
    );

    if (!conversation) {
      throw new Error("conversation_not_found");
    }

    if (
      conversation.profile_a_id !== actor.profileId &&
      conversation.profile_b_id !== actor.profileId
    ) {
      throw new Error("forbidden");
    }

    const normalizedLimit = normalizeLimit(limit, 100);
    let afterCreatedAt: string | undefined;

    if (after) {
      if (looksLikeIsoTimestamp(after)) {
        afterCreatedAt = after;
      } else {
        const afterRow = await this.db.get<{ created_at: string }>(
          `
            SELECT created_at
            FROM direct_messages
            WHERE id = ? AND conversation_id = ?
          `,
          after,
          conversationId,
        );
        afterCreatedAt = afterRow?.created_at;
      }
    }

    const rows = await this.db.all<DirectMessageRow[]>(
      `
        SELECT
          id,
          conversation_id,
          sender_profile_id,
          sender_character_id,
          sender_character_name,
          body,
          created_at
        FROM direct_messages
        WHERE conversation_id = ?
          AND (? IS NULL OR datetime(created_at) > datetime(?))
        ORDER BY datetime(created_at) ASC
        LIMIT ?
      `,
      conversationId,
      afterCreatedAt ?? null,
      afterCreatedAt ?? null,
      normalizedLimit,
    );

    const messages: ChatMessageDto[] = [];

    for (const row of rows) {
      const sender = await this.getIdentity(
        row.sender_profile_id,
        row.sender_character_id ?? undefined,
        actor.profileId,
      );
      messages.push({
        id: row.id,
        channelId: row.conversation_id,
        channelType: "direct",
        senderProfileId: row.sender_profile_id,
        senderCharacterId: row.sender_character_id ?? undefined,
        senderCharacterName: row.sender_character_name ?? undefined,
        body: row.body,
        createdAt: row.created_at,
        messageType: "user",
        sender,
      });
    }

    return messages;
  }

  private async appendDirectMessage(
    actor: SocialActorContext,
    conversation: DirectConversationRow,
    targetProfileId: string,
    body: string,
  ): Promise<{ conversationId: string; message: ChatMessageDto }> {
    await this.ensureDirectMessagingAllowed(actor, targetProfileId);
    const normalizedBody = normalizeBody(body);

    if (!normalizedBody) {
      throw new Error("invalid_chat_message");
    }

    const messageId = randomUUID();

    await this.db.run(
      `
        INSERT INTO direct_messages (
          id,
          conversation_id,
          sender_profile_id,
          sender_character_id,
          sender_character_name,
          body,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      messageId,
      conversation.id,
      actor.profileId,
      actor.characterId,
      actor.characterName ?? actor.profileDisplayName ?? null,
      normalizedBody,
    );

    await this.db.run(
      `
        UPDATE direct_conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      conversation.id,
    );

    const sender = await this.getIdentity(
      actor.profileId,
      actor.characterId,
      actor.profileId,
    );
    const created = await this.db.get<DirectMessageRow>(
      `
        SELECT
          id,
          conversation_id,
          sender_profile_id,
          sender_character_id,
          sender_character_name,
          body,
          created_at
        FROM direct_messages
        WHERE id = ?
      `,
      messageId,
    );

    if (!created) {
      throw new Error("chat_append_failed");
    }

    return {
      conversationId: conversation.id,
      message: {
        id: created.id,
        channelId: created.conversation_id,
        channelType: "direct",
        senderProfileId: created.sender_profile_id,
        senderCharacterId: created.sender_character_id ?? undefined,
        senderCharacterName: created.sender_character_name ?? undefined,
        body: created.body,
        createdAt: created.created_at,
        messageType: "user",
        sender,
      },
    };
  }

  private async ensureDirectMessagingAllowed(
    actor: SocialActorContext,
    targetProfileId: string,
  ): Promise<void> {
    if (await this.isProfileMuted(actor.profileId)) {
      throw new Error("chat_blocked");
    }

    if (await this.isEitherBlocked(actor.profileId, targetProfileId)) {
      throw new Error("direct_blocked");
    }

    const privacy = await this.getPrivacySettings(targetProfileId);
    const areFriends = await this.areProfilesFriends(
      actor.profileId,
      targetProfileId,
    );

    if (privacy.allowWhispersFrom === "none") {
      throw new Error("direct_blocked");
    }

    if (privacy.allowWhispersFrom === "friends" && !areFriends) {
      throw new Error("direct_blocked");
    }
  }

  private async getDirectConversation(
    conversationId: string,
  ): Promise<DirectConversationRow | null> {
    return (
      (await this.db.get<DirectConversationRow>(
        `
          SELECT id, profile_a_id, profile_b_id, updated_at
          FROM direct_conversations
          WHERE id = ?
        `,
        conversationId,
      )) ?? null
    );
  }

  async listPlayers(
    actor: SocialActorContext,
    input: { search?: string; page: number; pageSize: number },
  ): Promise<{ total: number; entries: readonly PlayerPresenceDto[] }> {
    await this.refreshPresenceFromSessions();
    const normalizedPage = Math.max(1, input.page);
    const normalizedPageSize = normalizeLimit(input.pageSize, 100);
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const search = input.search?.trim().toLowerCase() ?? "";
    const like = search ? `%${search}%` : null;

    const totalRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM player_presence
        WHERE (
          ? IS NULL
          OR lower(COALESCE(profile_display_name, '')) LIKE ?
          OR lower(COALESCE(current_character_name, '')) LIKE ?
        )
      `,
      like,
      like,
      like,
    );

    const rows = await this.db.all<PresenceRow[]>(
      `
        SELECT
          player_presence.profile_id,
          player_presence.profile_display_name,
          player_presence.current_character_id,
          player_presence.current_character_name,
          guilds.short_name AS guild_short_name,
          player_presence.online,
          player_presence.last_online_at
        FROM player_presence
        LEFT JOIN guild_members
          ON guild_members.character_id = player_presence.current_character_id
        LEFT JOIN guilds
          ON guilds.id = guild_members.guild_id
        WHERE (
          ? IS NULL
          OR lower(COALESCE(profile_display_name, '')) LIKE ?
          OR lower(COALESCE(current_character_name, '')) LIKE ?
        )
        ORDER BY
          online DESC,
          datetime(last_online_at) DESC
        LIMIT ? OFFSET ?
      `,
      like,
      like,
      like,
      normalizedPageSize,
      offset,
    );

    return {
      total: totalRow?.count ?? 0,
      entries: rows.map((row) => ({
        profileId: row.profile_id,
        profileDisplayName: row.profile_display_name ?? undefined,
        currentCharacterId: row.current_character_id ?? undefined,
        currentCharacterName: row.current_character_name ?? undefined,
        guildShortName: row.guild_short_name ?? undefined,
        online: Boolean(row.online),
        lastOnlineAt: row.last_online_at ?? undefined,
      })),
    };
  }

  async addFriend(actor: SocialActorContext, target: string): Promise<void> {
    const targetProfileId = await this.resolveProfileByCharacterOrProfileName(target);

    if (!targetProfileId) {
      throw new Error("target_not_found");
    }

    if (targetProfileId === actor.profileId) {
      throw new Error("cannot_target_self");
    }

    await this.db.run(
      `
        INSERT OR IGNORE INTO social_friend_links (
          profile_id,
          target_profile_id,
          created_at
        )
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `,
      actor.profileId,
      targetProfileId,
    );
    await this.db.run(
      `
        INSERT OR IGNORE INTO social_friend_links (
          profile_id,
          target_profile_id,
          created_at
        )
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `,
      targetProfileId,
      actor.profileId,
    );
  }

  async setBlock(actor: SocialActorContext, targetProfileId: string, blocked: boolean): Promise<void> {
    if (targetProfileId === actor.profileId) {
      throw new Error("cannot_target_self");
    }

    await this.setBlockedProfile({
      blockerProfileId: actor.profileId,
      blockedProfileId: targetProfileId,
      blocked,
    });
  }

  async getProfileSummary(profileId: string): Promise<{
    profileId: string;
    displayName: string | null;
    characters: readonly { id: string; name: string }[];
    currentCharacterId?: string;
    currentCharacterName?: string;
    badges: readonly SocialBadgeDto[];
    friendCount: number;
    guild?: { id: string; name: string; role: string };
  } | null> {
    const profile = await this.db.get<{ id: string; display_name: string | null }>(
      `
        SELECT id, display_name
        FROM player_profiles
        WHERE id = ?
      `,
      profileId,
    );

    if (!profile) {
      return null;
    }

    const characters = await this.db.all<Array<{ id: string; name: string }>>(
      `
        SELECT id, name
        FROM player_characters
        WHERE profile_id = ?
        ORDER BY created_at ASC
      `,
      profileId,
    );

    const presence = await this.db.get<{
      current_character_id: string | null;
      current_character_name: string | null;
    }>(
      `
        SELECT current_character_id, current_character_name
        FROM player_presence
        WHERE profile_id = ?
      `,
      profileId,
    );

    const rank = await this.db.get<{ rank: "player" | "vip" | "moderator" | "admin" }>(
      `
        SELECT rank
        FROM allowed_players
        WHERE player_uuid IN (
          SELECT id FROM player_characters WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 1
        )
        LIMIT 1
      `,
      profileId,
    );

    const friendCountRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM social_friend_links
        WHERE profile_id = ?
      `,
      profileId,
    );

    const guild = await this.db.get<{ guild_id: string; guild_name: string; role: string }>(
      `
        SELECT guild_members.guild_id, guilds.name AS guild_name, guild_members.role
        FROM guild_members
        INNER JOIN guilds ON guilds.id = guild_members.guild_id
        WHERE guild_members.profile_id = ?
        ORDER BY datetime(guild_members.joined_at) DESC
        LIMIT 1
      `,
      profileId,
    );

    return {
      profileId: profile.id,
      displayName: profile.display_name,
      characters,
      currentCharacterId: presence?.current_character_id ?? undefined,
      currentCharacterName: presence?.current_character_name ?? undefined,
      badges: buildBadges({
        rank: rank?.rank ?? "player",
        guildRole: guild?.role,
      }),
      friendCount: friendCountRow?.count ?? 0,
      guild: guild
        ? {
            id: guild.guild_id,
            name: guild.guild_name,
            role: guild.role,
          }
        : undefined,
    };
  }

  async getAdminProfileOverview(profileId: string): Promise<{
    profileId: string;
    displayName: string | null;
    characters: readonly {
      id: string;
      name: string;
      rank: string;
      chatAccess: "allowed" | "timed_out" | "banned";
      chatReason?: string;
      chatTimeoutUntil?: string;
      serverBanned: boolean;
    }[];
    friendCount: number;
    blockedCount: number;
    lastOnlineAt?: string;
  } | null> {
    const profile = await this.db.get<{ id: string; display_name: string | null }>(
      `
        SELECT id, display_name
        FROM player_profiles
        WHERE id = ?
      `,
      profileId,
    );

    if (!profile) {
      return null;
    }

    const characters = await this.db.all<
      Array<{
        id: string;
        name: string;
        rank: string | null;
        chat_timeout_until: string | null;
        chat_timeout_reason: string | null;
        chat_banned_at: string | null;
        chat_ban_reason: string | null;
        server_banned_at: string | null;
      }>
    >(
      `
        SELECT
          player_characters.id,
          player_characters.name,
          allowed_players.rank,
          allowed_players.chat_timeout_until,
          allowed_players.chat_timeout_reason,
          allowed_players.chat_banned_at,
          allowed_players.chat_ban_reason,
          allowed_players.server_banned_at
        FROM player_characters
        LEFT JOIN allowed_players
          ON allowed_players.player_uuid = player_characters.id
        WHERE player_characters.profile_id = ?
        ORDER BY player_characters.created_at ASC
      `,
      profileId,
    );

    const friendCountRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM social_friend_links
        WHERE profile_id = ?
      `,
      profileId,
    );
    const blockedCountRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM social_blocks
        WHERE profile_id = ?
      `,
      profileId,
    );
    const presence = await this.db.get<{ last_online_at: string | null }>(
      `
        SELECT last_online_at
        FROM player_presence
        WHERE profile_id = ?
      `,
      profileId,
    );

    return {
      profileId: profile.id,
      displayName: profile.display_name,
      characters: characters.map((character) => ({
        id: character.id,
        name: character.name,
        rank: character.rank ?? "player",
        chatAccess: character.chat_banned_at
          ? "banned"
          : resolveActiveTimeout(character.chat_timeout_until)
            ? "timed_out"
            : "allowed",
        chatReason: character.chat_ban_reason ?? character.chat_timeout_reason ?? undefined,
        chatTimeoutUntil: resolveActiveTimeout(character.chat_timeout_until) ?? undefined,
        serverBanned: Boolean(character.server_banned_at),
      })),
      friendCount: friendCountRow?.count ?? 0,
      blockedCount: blockedCountRow?.count ?? 0,
      lastOnlineAt: presence?.last_online_at ?? undefined,
    };
  }

  async listAdminPlayers(input: {
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; entries: readonly PlayerPresenceDto[] }> {
    await this.refreshPresenceFromSessions();
    const normalizedPage = Math.max(1, input.page);
    const normalizedPageSize = normalizeLimit(input.pageSize, 100);
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const search = input.search?.trim().toLowerCase() ?? "";
    const like = search ? `%${search}%` : null;

    const totalRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM player_presence
        WHERE (
          ? IS NULL
          OR lower(COALESCE(profile_display_name, '')) LIKE ?
          OR lower(COALESCE(current_character_name, '')) LIKE ?
        )
      `,
      like,
      like,
      like,
    );

    const rows = await this.db.all<PresenceRow[]>(
      `
        SELECT
          profile_id,
          profile_display_name,
          current_character_id,
          current_character_name,
          online,
          last_online_at
        FROM player_presence
        WHERE (
          ? IS NULL
          OR lower(COALESCE(profile_display_name, '')) LIKE ?
          OR lower(COALESCE(current_character_name, '')) LIKE ?
        )
        ORDER BY
          online DESC,
          datetime(last_online_at) DESC
        LIMIT ? OFFSET ?
      `,
      like,
      like,
      like,
      normalizedPageSize,
      offset,
    );

    return {
      total: totalRow?.count ?? 0,
      entries: rows.map((row) => ({
        profileId: row.profile_id,
        profileDisplayName: row.profile_display_name ?? undefined,
        currentCharacterId: row.current_character_id ?? undefined,
        currentCharacterName: row.current_character_name ?? undefined,
        online: Boolean(row.online),
        lastOnlineAt: row.last_online_at ?? undefined,
      })),
    };
  }

  async getAdminProfileDetail(profileId: string): Promise<AdminProfileDetailDto | null> {
    const profile = await this.db.get<{ id: string; display_name: string | null }>(
      `
        SELECT id, display_name
        FROM player_profiles
        WHERE id = ?
      `,
      profileId,
    );

    if (!profile) {
      return null;
    }

    const presence = await this.db.get<{
      online: number;
      last_online_at: string | null;
      current_character_id: string | null;
    }>(
      `
        SELECT online, last_online_at, current_character_id
        FROM player_presence
        WHERE profile_id = ?
      `,
      profileId,
    );

    const characters = await this.db.all<
      Array<{
        character_id: string;
        name: string;
        online: number;
        guild_id: string | null;
        guild_name: string | null;
        role: string | null;
      }>
    >(
      `
        SELECT
          player_characters.id AS character_id,
          player_characters.name,
          CASE WHEN player_presence.current_character_id = player_characters.id
            AND player_presence.online = 1
          THEN 1 ELSE 0 END AS online,
          guild_members.guild_id,
          guilds.name AS guild_name,
          guild_members.role
        FROM player_characters
        LEFT JOIN player_presence
          ON player_presence.profile_id = player_characters.profile_id
        LEFT JOIN guild_members
          ON guild_members.character_id = player_characters.id
        LEFT JOIN guilds
          ON guilds.id = guild_members.guild_id
        WHERE player_characters.profile_id = ?
        ORDER BY player_characters.created_at ASC
      `,
      profileId,
    );

    const permissions = await this.getProfilePermissions(profileId);
    const moderation = await this.getActiveModerationState(profileId);
    const friendCountRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM friendships
        WHERE (
          requester_profile_id = ?
          OR target_profile_id = ?
        )
          AND status = 'accepted'
      `,
      profileId,
      profileId,
    );
    const notes = await this.listAdminNotes(profileId);
    const guildMemberships = characters
      .filter((character) => character.guild_id && character.guild_name && character.role)
      .map((character) => ({
        guildId: character.guild_id!,
        guildName: character.guild_name!,
        role: character.role!,
        characterId: character.character_id,
      }));

    const mappedCharacters: AdminCharacterSummaryDto[] = characters.map((character) => ({
      characterId: character.character_id,
      name: character.name,
      online: Boolean(character.online),
      guildId: character.guild_id ?? undefined,
      guildName: character.guild_name ?? undefined,
      role: character.role ?? undefined,
      savedProgressSummary: undefined,
    }));

    return {
      profileId: profile.id,
      displayName: profile.display_name ?? undefined,
      online: Boolean(presence?.online),
      lastOnlineAt: presence?.last_online_at ?? undefined,
      moderation,
      permissions,
      characters: mappedCharacters,
      currentOnlineCharacterId: presence?.current_character_id ?? undefined,
      friendCount: friendCountRow?.count ?? 0,
      guildMemberships,
      adminNotes: notes,
    };
  }

  getGrantablePermissions(): readonly string[] {
    return [...GRANTABLE_PROFILE_PERMISSIONS.values()];
  }

  async getProfilePermissions(profileId: string): Promise<readonly AdminPermissionDto[]> {
    const rows = await this.db.all<
      Array<{
        permission_id: string;
        granted_at: string;
        granted_by_profile_id: string;
      }>
    >(
      `
        SELECT permission_id, granted_at, granted_by_profile_id
        FROM profile_permissions
        WHERE profile_id = ?
        ORDER BY datetime(granted_at) DESC
      `,
      profileId,
    );

    return rows.map((row) => ({
      permissionId: row.permission_id,
      grantedAt: row.granted_at,
      grantedByProfileId: row.granted_by_profile_id,
    }));
  }

  async hasProfilePermission(profileId: string, permissionId: string): Promise<boolean> {
    const row = await this.db.get<{ has_permission: number }>(
      `
        SELECT 1 AS has_permission
        FROM profile_permissions
        WHERE profile_id = ? AND permission_id = ?
        LIMIT 1
      `,
      profileId,
      permissionId,
    );

    return Boolean(row?.has_permission);
  }

  async grantProfilePermission(
    actorProfileId: string,
    targetProfileId: string,
    permissionId: string,
  ): Promise<void> {
    if (!GRANTABLE_PROFILE_PERMISSIONS.has(permissionId)) {
      throw new Error("permission_not_grantable");
    }

    await this.db.run(
      `
        INSERT INTO profile_permissions (
          profile_id,
          permission_id,
          granted_by_profile_id,
          granted_at
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(profile_id, permission_id) DO UPDATE SET
          granted_by_profile_id = excluded.granted_by_profile_id,
          granted_at = CURRENT_TIMESTAMP
      `,
      targetProfileId,
      permissionId,
      actorProfileId,
    );

    await this.appendAdminAuditLog(actorProfileId, targetProfileId, "permission_grant", {
      permissionId,
    });
  }

  async revokeProfilePermission(
    actorProfileId: string,
    targetProfileId: string,
    permissionId: string,
  ): Promise<void> {
    await this.db.run(
      `
        DELETE FROM profile_permissions
        WHERE profile_id = ? AND permission_id = ?
      `,
      targetProfileId,
      permissionId,
    );

    await this.appendAdminAuditLog(actorProfileId, targetProfileId, "permission_revoke", {
      permissionId,
    });
  }

  async addAdminNote(
    actorProfileId: string,
    targetProfileId: string,
    body: string,
  ): Promise<AdminProfileNoteDto> {
    const trimmed = body.trim();

    if (!trimmed) {
      throw new Error("invalid_note");
    }

    const noteId = randomUUID();
    await this.db.run(
      `
        INSERT INTO admin_profile_notes (
          id,
          target_profile_id,
          author_profile_id,
          body,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      noteId,
      targetProfileId,
      actorProfileId,
      trimmed,
    );
    await this.appendAdminAuditLog(actorProfileId, targetProfileId, "admin_note_create", {
      noteId,
      body: trimmed,
    });

    const created = await this.getAdminNoteById(noteId);

    if (!created) {
      throw new Error("note_create_failed");
    }

    return created;
  }

  async updateAdminNote(
    actorProfileId: string,
    targetProfileId: string,
    noteId: string,
    body: string,
  ): Promise<AdminProfileNoteDto> {
    const trimmed = body.trim();

    if (!trimmed) {
      throw new Error("invalid_note");
    }

    await this.db.run(
      `
        UPDATE admin_profile_notes
        SET body = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND target_profile_id = ?
      `,
      trimmed,
      noteId,
      targetProfileId,
    );

    await this.appendAdminAuditLog(actorProfileId, targetProfileId, "admin_note_update", {
      noteId,
      body: trimmed,
    });

    const updated = await this.getAdminNoteById(noteId);

    if (!updated) {
      throw new Error("note_not_found");
    }

    return updated;
  }

  async deleteAdminNote(
    actorProfileId: string,
    targetProfileId: string,
    noteId: string,
  ): Promise<void> {
    await this.db.run(
      `
        DELETE FROM admin_profile_notes
        WHERE id = ? AND target_profile_id = ?
      `,
      noteId,
      targetProfileId,
    );
    await this.appendAdminAuditLog(actorProfileId, targetProfileId, "admin_note_delete", {
      noteId,
    });
  }

  async listAdminNotes(targetProfileId: string): Promise<readonly AdminProfileNoteDto[]> {
    const rows = await this.db.all<
      Array<{
        id: string;
        target_profile_id: string;
        author_profile_id: string;
        body: string;
        created_at: string;
        updated_at: string;
      }>
    >(
      `
        SELECT id, target_profile_id, author_profile_id, body, created_at, updated_at
        FROM admin_profile_notes
        WHERE target_profile_id = ?
        ORDER BY datetime(created_at) DESC
      `,
      targetProfileId,
    );

    return rows.map((row) => ({
      id: row.id,
      targetProfileId: row.target_profile_id,
      authorProfileId: row.author_profile_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listAdminAuditLog(input: {
    page: number;
    pageSize: number;
    targetProfileId?: string;
  }): Promise<{ total: number; entries: readonly {
    id: string;
    actorProfileId: string;
    targetProfileId?: string;
    actionType: string;
    payloadJson?: string;
    createdAt: string;
  }[] }> {
    const page = Math.max(1, input.page);
    const pageSize = normalizeLimit(input.pageSize, 100);
    const offset = (page - 1) * pageSize;

    const totalRow = await this.db.get<{ count: number }>(
      `
        SELECT COUNT(1) AS count
        FROM admin_audit_log
        WHERE (? IS NULL OR target_profile_id = ?)
      `,
      input.targetProfileId ?? null,
      input.targetProfileId ?? null,
    );

    const rows = await this.db.all<
      Array<{
        id: string;
        actor_profile_id: string;
        target_profile_id: string | null;
        action_type: string;
        payload_json: string | null;
        created_at: string;
      }>
    >(
      `
        SELECT
          id,
          actor_profile_id,
          target_profile_id,
          action_type,
          payload_json,
          created_at
        FROM admin_audit_log
        WHERE (? IS NULL OR target_profile_id = ?)
        ORDER BY datetime(created_at) DESC
        LIMIT ? OFFSET ?
      `,
      input.targetProfileId ?? null,
      input.targetProfileId ?? null,
      pageSize,
      offset,
    );

    return {
      total: totalRow?.count ?? 0,
      entries: rows.map((row) => ({
        id: row.id,
        actorProfileId: row.actor_profile_id,
        targetProfileId: row.target_profile_id ?? undefined,
        actionType: row.action_type,
        payloadJson: row.payload_json ?? undefined,
        createdAt: row.created_at,
      })),
    };
  }

  async applyProfileModerationAction(input: {
    actorProfileId: string;
    targetProfileId: string;
    type: "kick" | "ban" | "mute" | "warn";
    reason?: string;
    expiresAt?: string;
  }): Promise<void> {
    const moderationId = randomUUID();

    await this.db.run(
      `
        INSERT INTO moderation_actions (
          id,
          target_profile_id,
          actor_profile_id,
          type,
          reason,
          starts_at,
          expires_at,
          active,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 1, CURRENT_TIMESTAMP)
      `,
      moderationId,
      input.targetProfileId,
      input.actorProfileId,
      input.type,
      input.reason ?? null,
      input.expiresAt ?? null,
    );

    if (input.type === "ban") {
      await this.db.run(
        `
          UPDATE allowed_players
          SET server_banned_at = CURRENT_TIMESTAMP,
              server_ban_reason = COALESCE(?, server_ban_reason),
              updated_at = CURRENT_TIMESTAMP
          WHERE player_uuid IN (
            SELECT id FROM player_characters WHERE profile_id = ?
          )
        `,
        input.reason ?? null,
        input.targetProfileId,
      );

      await this.db.run(
        `
          DELETE FROM server_sessions
          WHERE player_uuid IN (
            SELECT id FROM player_characters WHERE profile_id = ?
          )
        `,
        input.targetProfileId,
      );
    }

    if (input.type === "kick") {
      await this.db.run(
        `
          DELETE FROM server_sessions
          WHERE player_uuid IN (
            SELECT id FROM player_characters WHERE profile_id = ?
          )
        `,
        input.targetProfileId,
      );
    }

    if (input.type === "mute") {
      await this.db.run(
        `
          UPDATE allowed_players
          SET chat_banned_at = CURRENT_TIMESTAMP,
              chat_ban_reason = COALESCE(?, chat_ban_reason),
              updated_at = CURRENT_TIMESTAMP
          WHERE player_uuid IN (
            SELECT id FROM player_characters WHERE profile_id = ?
          )
        `,
        input.reason ?? null,
        input.targetProfileId,
      );
    }

    await this.appendAdminAuditLog(input.actorProfileId, input.targetProfileId, input.type, {
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ?? null,
      moderationId,
    });
  }

  async clearProfileModerationAction(input: {
    actorProfileId: string;
    targetProfileId: string;
    type: "ban" | "mute";
    reason?: string;
  }): Promise<void> {
    await this.db.run(
      `
        UPDATE moderation_actions
        SET active = 0
        WHERE target_profile_id = ?
          AND type = ?
          AND active = 1
      `,
      input.targetProfileId,
      input.type,
    );

    if (input.type === "ban") {
      await this.db.run(
        `
          UPDATE allowed_players
          SET server_banned_at = NULL,
              server_ban_reason = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE player_uuid IN (
            SELECT id FROM player_characters WHERE profile_id = ?
          )
        `,
        input.targetProfileId,
      );
    }

    if (input.type === "mute") {
      await this.db.run(
        `
          UPDATE allowed_players
          SET chat_banned_at = NULL,
              chat_ban_reason = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE player_uuid IN (
            SELECT id FROM player_characters WHERE profile_id = ?
          )
        `,
        input.targetProfileId,
      );
    }

    await this.appendAdminAuditLog(input.actorProfileId, input.targetProfileId, `${input.type}_clear`, {
      reason: input.reason ?? null,
    });
  }

  async listFriendships(profileId: string): Promise<readonly {
    id: string;
    requesterProfileId: string;
    targetProfileId: string;
    counterpartProfileId: string;
    counterpartDisplayName?: string;
    counterpartCurrentCharacterName?: string;
    counterpartOnline: boolean;
    counterpartLastOnlineAt?: string;
    type: "character" | "profile";
    status: "pending_outgoing" | "pending_incoming" | "accepted" | "blocked";
    updatedAt: string;
  }[]> {
    const rows = await this.db.all<
      Array<{
        id: string;
        requester_profile_id: string;
        target_profile_id: string;
        requester_display_name: string | null;
        target_display_name: string | null;
        requester_online: number | null;
        target_online: number | null;
        requester_last_online_at: string | null;
        target_last_online_at: string | null;
        requester_current_character_name: string | null;
        target_current_character_name: string | null;
        type: "character" | "profile";
        status: "pending" | "accepted" | "blocked";
        updated_at: string;
      }>
    >(
      `
        SELECT
          friendships.id,
          friendships.requester_profile_id,
          friendships.target_profile_id,
          friendships.type,
          friendships.status,
          friendships.updated_at,
          requester_profile.display_name AS requester_display_name,
          target_profile.display_name AS target_display_name,
          requester_presence.online AS requester_online,
          target_presence.online AS target_online,
          requester_presence.last_online_at AS requester_last_online_at,
          target_presence.last_online_at AS target_last_online_at,
          requester_presence.current_character_name AS requester_current_character_name,
          target_presence.current_character_name AS target_current_character_name
        FROM friendships
        LEFT JOIN player_profiles requester_profile
          ON requester_profile.id = friendships.requester_profile_id
        LEFT JOIN player_profiles target_profile
          ON target_profile.id = friendships.target_profile_id
        LEFT JOIN player_presence requester_presence
          ON requester_presence.profile_id = friendships.requester_profile_id
        LEFT JOIN player_presence target_presence
          ON target_presence.profile_id = friendships.target_profile_id
        WHERE requester_profile_id = ?
           OR target_profile_id = ?
        ORDER BY datetime(friendships.updated_at) DESC
      `,
      profileId,
      profileId,
    );

    return rows.map((row) => {
      const requesterIsViewer = row.requester_profile_id === profileId;
      const counterpartProfileId = requesterIsViewer ? row.target_profile_id : row.requester_profile_id;

      return {
        id: row.id,
        requesterProfileId: row.requester_profile_id,
        targetProfileId: row.target_profile_id,
        counterpartProfileId,
        counterpartDisplayName: requesterIsViewer
          ? row.target_display_name ?? undefined
          : row.requester_display_name ?? undefined,
        counterpartCurrentCharacterName: requesterIsViewer
          ? row.target_current_character_name ?? undefined
          : row.requester_current_character_name ?? undefined,
        counterpartOnline: requesterIsViewer
          ? Boolean(row.target_online)
          : Boolean(row.requester_online),
        counterpartLastOnlineAt: requesterIsViewer
          ? row.target_last_online_at ?? undefined
          : row.requester_last_online_at ?? undefined,
        type: row.type,
        status:
          row.status === "accepted"
            ? "accepted"
            : row.status === "blocked"
              ? "blocked"
              : requesterIsViewer
                ? "pending_outgoing"
                : "pending_incoming",
        updatedAt: row.updated_at,
      };
    });
  }

  async createCharacterFriendship(input: {
    requesterProfileId: string;
    requesterCharacterId: string;
    targetProfileId: string;
    targetCharacterId?: string;
  }): Promise<void> {
    await this.db.run(
      `
        INSERT INTO friendships (
          id,
          requester_profile_id,
          requester_character_id,
          target_profile_id,
          target_character_id,
          type,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'character', 'accepted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      randomUUID(),
      input.requesterProfileId,
      input.requesterCharacterId,
      input.targetProfileId,
      input.targetCharacterId ?? null,
    );
  }

  async createProfileFriendRequest(input: {
    requesterProfileId: string;
    targetProfileId: string;
  }): Promise<void> {
    if (input.requesterProfileId === input.targetProfileId) {
      throw new Error("cannot_target_self");
    }

    await this.ensureProfileExists(input.targetProfileId);

    if (await this.isEitherBlocked(input.requesterProfileId, input.targetProfileId)) {
      throw new Error("friend_request_blocked");
    }

    const privacy = await this.getPrivacySettings(input.targetProfileId);

    if (!privacy.allowFriendRequests) {
      throw new Error("friend_request_blocked");
    }

    await this.db.run(
      `
        INSERT INTO friendships (
          id,
          requester_profile_id,
          requester_character_id,
          target_profile_id,
          target_character_id,
          type,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, NULL, ?, NULL, 'profile', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      randomUUID(),
      input.requesterProfileId,
      input.targetProfileId,
    );
  }

  async respondProfileFriendRequest(input: {
    actorProfileId: string;
    friendshipId: string;
    accept: boolean;
  }): Promise<void> {
    const friendship = await this.db.get<{
      id: string;
      requester_profile_id: string;
      target_profile_id: string;
      type: string;
      status: string;
    }>(
      `
        SELECT id, requester_profile_id, target_profile_id, type, status
        FROM friendships
        WHERE id = ?
      `,
      input.friendshipId,
    );

    if (!friendship || friendship.target_profile_id !== input.actorProfileId || friendship.type !== "profile") {
      throw new Error("friendship_not_found");
    }

    if (input.accept) {
      await this.db.run(
        `
          UPDATE friendships
          SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        input.friendshipId,
      );
      return;
    }

    await this.db.run(
      `
        DELETE FROM friendships
        WHERE id = ?
      `,
      input.friendshipId,
    );
  }

  async removeFriendship(actorProfileId: string, friendshipId: string): Promise<void> {
    await this.db.run(
      `
        DELETE FROM friendships
        WHERE id = ?
          AND (requester_profile_id = ? OR target_profile_id = ?)
      `,
      friendshipId,
      actorProfileId,
      actorProfileId,
    );
  }

  async listBlockedProfiles(profileId: string): Promise<readonly {
    blockedProfileId: string;
    reason?: string;
    createdAt: string;
  }[]> {
    const rows = await this.db.all<
      Array<{
        blocked_profile_id: string;
        reason: string | null;
        created_at: string;
      }>
    >(
      `
        SELECT blocked_profile_id, reason, created_at
        FROM blocked_profiles
        WHERE blocker_profile_id = ?
        ORDER BY datetime(created_at) DESC
      `,
      profileId,
    );

    return rows.map((row) => ({
      blockedProfileId: row.blocked_profile_id,
      reason: row.reason ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async setBlockedProfile(input: {
    blockerProfileId: string;
    blockedProfileId: string;
    reason?: string;
    blocked: boolean;
  }): Promise<void> {
    if (input.blockerProfileId === input.blockedProfileId) {
      throw new Error("cannot_target_self");
    }

    await this.ensureProfileExists(input.blockedProfileId);

    if (input.blocked) {
      await this.db.run(
        `
          INSERT INTO blocked_profiles (
            blocker_profile_id,
            blocked_profile_id,
            reason,
            created_at
          )
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(blocker_profile_id, blocked_profile_id) DO UPDATE SET
            reason = COALESCE(excluded.reason, blocked_profiles.reason),
            created_at = CURRENT_TIMESTAMP
        `,
        input.blockerProfileId,
        input.blockedProfileId,
        input.reason ?? null,
      );
      return;
    }

    await this.db.run(
      `
        DELETE FROM blocked_profiles
        WHERE blocker_profile_id = ? AND blocked_profile_id = ?
      `,
      input.blockerProfileId,
      input.blockedProfileId,
    );
  }

  async getPrivacySettings(profileId: string): Promise<{
    showOnlineToFriends: boolean;
    allowFriendRequests: boolean;
    allowWhispersFrom: "everyone" | "friends" | "none";
  }> {
    const row = await this.db.get<{
      show_online_to_friends: number;
      allow_friend_requests: number;
      allow_whispers_from: "everyone" | "friends" | "none";
    }>(
      `
        SELECT show_online_to_friends, allow_friend_requests, allow_whispers_from
        FROM social_privacy_settings
        WHERE profile_id = ?
      `,
      profileId,
    );

    if (!row) {
      await this.db.run(
        `
          INSERT INTO social_privacy_settings (
            profile_id,
            show_online_to_friends,
            allow_friend_requests,
            allow_whispers_from,
            updated_at
          )
          VALUES (?, 1, 1, 'everyone', CURRENT_TIMESTAMP)
        `,
        profileId,
      );
      return {
        showOnlineToFriends: true,
        allowFriendRequests: true,
        allowWhispersFrom: "everyone",
      };
    }

    return {
      showOnlineToFriends: Boolean(row.show_online_to_friends),
      allowFriendRequests: Boolean(row.allow_friend_requests),
      allowWhispersFrom: row.allow_whispers_from,
    };
  }

  async updatePrivacySettings(input: {
    profileId: string;
    showOnlineToFriends?: boolean;
    allowFriendRequests?: boolean;
    allowWhispersFrom?: "everyone" | "friends" | "none";
  }): Promise<void> {
    const current = await this.getPrivacySettings(input.profileId);

    await this.db.run(
      `
        UPDATE social_privacy_settings
        SET show_online_to_friends = ?,
            allow_friend_requests = ?,
            allow_whispers_from = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE profile_id = ?
      `,
      (input.showOnlineToFriends ?? current.showOnlineToFriends) ? 1 : 0,
      (input.allowFriendRequests ?? current.allowFriendRequests) ? 1 : 0,
      input.allowWhispersFrom ?? current.allowWhispersFrom,
      input.profileId,
    );
  }

  async createGuild(input: {
    actorProfileId: string;
    actorCharacterId: string;
    name: string;
    shortName: string;
  }): Promise<{ id: string; name: string; shortName: string }> {
    await this.ensureProfileExists(input.actorProfileId);
    await this.ensureCharacterExists(
      input.actorCharacterId,
      input.actorProfileId,
    );

    const existingMembership = await this.db.get<{ guild_id: string }>(
      `
        SELECT guild_id
        FROM guild_members
        WHERE character_id = ?
      `,
      input.actorCharacterId,
    );

    if (existingMembership) {
      throw new Error("guild_already_joined");
    }

    const guildId = randomUUID();
    const normalizedShortName = normalizeGuildShortName(input.shortName);
    const existingShortName = await this.db.get<{ id: string }>(
      `
        SELECT id
        FROM guilds
        WHERE upper(short_name) = ?
        LIMIT 1
      `,
      normalizedShortName,
    );

    if (existingShortName) {
      throw new Error("guild_short_name_taken");
    }

    await this.db.run(
      `
        INSERT INTO guilds (
          id,
          name,
          short_name,
          created_by_profile_id,
          created_by_character_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      guildId,
      input.name.trim(),
      normalizedShortName,
      input.actorProfileId,
      input.actorCharacterId,
    );

    await this.db.run(
      `
        INSERT INTO guild_members (
          guild_id,
          profile_id,
          character_id,
          role,
          joined_at
        )
        VALUES (?, ?, ?, 'guild_master', CURRENT_TIMESTAMP)
      `,
      guildId,
      input.actorProfileId,
      input.actorCharacterId,
    );

    await this.ensureGuildChannel(guildId, input.name.trim());

    return {
      id: guildId,
      name: input.name.trim(),
      shortName: normalizedShortName,
    };
  }

  async getCurrentGuild(characterId: string): Promise<{
    guildId: string;
    guildName: string;
    guildShortName?: string;
    role: string;
    members: readonly {
      characterId: string;
      profileId: string;
      name: string;
      role: string;
    }[];
  } | null> {
    const membership = await this.db.get<{
      guild_id: string;
      role: string;
      guild_name: string;
      guild_short_name: string | null;
    }>(
      `
        SELECT
          guild_members.guild_id,
          guild_members.role,
          guilds.name AS guild_name,
          guilds.short_name AS guild_short_name
        FROM guild_members
        INNER JOIN guilds ON guilds.id = guild_members.guild_id
        WHERE guild_members.character_id = ?
      `,
      characterId,
    );

    if (!membership) {
      return null;
    }

    const members = await this.db.all<
      Array<{
        character_id: string;
        profile_id: string;
        name: string;
        role: string;
      }>
    >(
      `
        SELECT
          guild_members.character_id,
          guild_members.profile_id,
          player_characters.name,
          guild_members.role
        FROM guild_members
        INNER JOIN player_characters ON player_characters.id = guild_members.character_id
        WHERE guild_members.guild_id = ?
        ORDER BY
          CASE guild_members.role
            WHEN 'guild_master' THEN 0
            WHEN 'officer' THEN 1
            WHEN 'member' THEN 2
            ELSE 3
          END,
          player_characters.name ASC
      `,
      membership.guild_id,
    );

    return {
      guildId: membership.guild_id,
      guildName: membership.guild_name,
      guildShortName: membership.guild_short_name ?? undefined,
      role: membership.role,
      members: members.map((member) => ({
        characterId: member.character_id,
        profileId: member.profile_id,
        name: member.name,
        role: member.role,
      })),
    };
  }

  async listPendingGuildInvitations(profileId: string): Promise<readonly {
    id: string;
    guildId: string;
    guildName: string;
    guildShortName?: string;
    inviterProfileId: string;
    inviterCharacterId?: string;
    targetCharacterId?: string;
    createdAt: string;
  }[]> {
    const rows = await this.db.all<
      Array<{
        id: string;
        guild_id: string;
        guild_name: string;
        guild_short_name: string | null;
        inviter_profile_id: string;
        inviter_character_id: string | null;
        target_character_id: string | null;
        created_at: string;
      }>
    >(
      `
        SELECT
          guild_invitations.id,
          guild_invitations.guild_id,
          guilds.name AS guild_name,
          guilds.short_name AS guild_short_name,
          guild_invitations.inviter_profile_id,
          guild_invitations.inviter_character_id,
          guild_invitations.target_character_id,
          guild_invitations.created_at
        FROM guild_invitations
        INNER JOIN guilds ON guilds.id = guild_invitations.guild_id
        WHERE guild_invitations.target_profile_id = ?
          AND guild_invitations.status = 'pending'
        ORDER BY datetime(guild_invitations.created_at) DESC
      `,
      profileId,
    );

    return rows.map((row) => ({
      id: row.id,
      guildId: row.guild_id,
      guildName: row.guild_name,
      guildShortName: row.guild_short_name ?? undefined,
      inviterProfileId: row.inviter_profile_id,
      inviterCharacterId: row.inviter_character_id ?? undefined,
      targetCharacterId: row.target_character_id ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async inviteToGuild(input: {
    guildId: string;
    inviterProfileId: string;
    inviterCharacterId: string;
    targetProfileId: string;
    targetCharacterId?: string;
  }): Promise<{ invitationId: string }> {
    await this.ensureProfileExists(input.inviterProfileId);
    await this.ensureCharacterExists(
      input.inviterCharacterId,
      input.inviterProfileId,
    );
    await this.ensureProfileExists(input.targetProfileId);

    const inviterRole = await this.db.get<{ role: string }>(
      `
        SELECT role
        FROM guild_members
        WHERE guild_id = ? AND character_id = ?
      `,
      input.guildId,
      input.inviterCharacterId,
    );

    if (!inviterRole || (inviterRole.role !== "guild_master" && inviterRole.role !== "officer")) {
      throw new Error("guild_invite_forbidden");
    }

    const invitationId = randomUUID();
    await this.db.run(
      `
        INSERT INTO guild_invitations (
          id,
          guild_id,
          inviter_profile_id,
          inviter_character_id,
          target_profile_id,
          target_character_id,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      invitationId,
      input.guildId,
      input.inviterProfileId,
      input.inviterCharacterId,
      input.targetProfileId,
      input.targetCharacterId ?? null,
    );

    return {
      invitationId,
    };
  }

  async respondGuildInvitation(input: {
    actorProfileId: string;
    actorCharacterId: string;
    actorCharacterName?: string;
    invitationId: string;
    accept: boolean;
  }): Promise<void> {
    const invitation = await this.db.get<{
      id: string;
      guild_id: string;
      target_profile_id: string;
      target_character_id: string | null;
      status: string;
    }>(
      `
        SELECT id, guild_id, target_profile_id, target_character_id, status
        FROM guild_invitations
        WHERE id = ?
      `,
      input.invitationId,
    );

    if (!invitation || invitation.target_profile_id !== input.actorProfileId || invitation.status !== "pending") {
      throw new Error("invitation_not_found");
    }

    if (input.accept) {
      await this.ensureProfileExists(input.actorProfileId);
      const characterId = invitation.target_character_id ?? input.actorCharacterId;

      await this.ensureCharacterExists(
        characterId,
        input.actorProfileId,
        input.actorCharacterName,
      );

      if (!characterId) {
        throw new Error("character_not_found");
      }

      await this.db.run(
        `
          INSERT INTO guild_members (guild_id, profile_id, character_id, role, joined_at)
          VALUES (?, ?, ?, 'recruit', CURRENT_TIMESTAMP)
          ON CONFLICT(guild_id, character_id) DO UPDATE SET
            profile_id = excluded.profile_id,
            role = excluded.role
        `,
        invitation.guild_id,
        input.actorProfileId,
        characterId,
      );
    }

    await this.db.run(
      `
        UPDATE guild_invitations
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      input.accept ? "accepted" : "rejected",
      input.invitationId,
    );
  }

  async setGuildMemberRole(input: {
    guildId: string;
    actorCharacterId: string;
    characterId: string;
    role: "guild_master" | "officer" | "member" | "recruit";
  }): Promise<void> {
    const actorMembership = await this.db.get<{ role: string }>(
      `
        SELECT role
        FROM guild_members
        WHERE guild_id = ? AND character_id = ?
      `,
      input.guildId,
      input.actorCharacterId,
    );

    if (!actorMembership || actorMembership.role !== "guild_master") {
      throw new Error("guild_role_forbidden");
    }

    await this.db.run(
      `
        UPDATE guild_members
        SET role = ?
        WHERE guild_id = ? AND character_id = ?
      `,
      input.role,
      input.guildId,
      input.characterId,
    );
  }

  async kickGuildMember(input: { guildId: string; actorCharacterId: string; characterId: string }): Promise<void> {
    const actorMembership = await this.db.get<{ role: string }>(
      `
        SELECT role
        FROM guild_members
        WHERE guild_id = ? AND character_id = ?
      `,
      input.guildId,
      input.actorCharacterId,
    );

    if (!actorMembership || (actorMembership.role !== "guild_master" && actorMembership.role !== "officer")) {
      throw new Error("guild_kick_forbidden");
    }

    if (input.characterId === input.actorCharacterId) {
      throw new Error("cannot_target_self");
    }

    await this.db.run(
      `
        DELETE FROM guild_members
        WHERE guild_id = ? AND character_id = ?
      `,
      input.guildId,
      input.characterId,
    );
  }

  async leaveGuild(input: { guildId: string; characterId: string }): Promise<void> {
    await this.db.run(
      `
        DELETE FROM guild_members
        WHERE guild_id = ? AND character_id = ?
      `,
      input.guildId,
      input.characterId,
    );
  }

  async createPlayerReport(input: {
    reporterProfileId: string;
    targetProfileId?: string;
    targetMessageId?: string;
    reason: string;
  }): Promise<{ reportId: string }> {
    if (input.targetProfileId) {
      if (input.targetProfileId === input.reporterProfileId) {
        throw new Error("cannot_target_self");
      }

      await this.ensureProfileExists(input.targetProfileId);
    }

    const reportId = randomUUID();
    await this.db.run(
      `
        INSERT INTO player_reports (
          id,
          reporter_profile_id,
          target_profile_id,
          target_message_id,
          reason,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      reportId,
      input.reporterProfileId,
      input.targetProfileId ?? null,
      input.targetMessageId ?? null,
      input.reason.trim(),
    );

    return { reportId };
  }

  async appendSystemMessage(input: {
    targetType: "profile" | "channel" | "admins";
    targetId?: string;
    channelId?: string;
    body: string;
    messageType?: "system" | "motd" | "moderation";
  }): Promise<void> {
    const messageId = randomUUID();
    await this.db.run(
      `
        INSERT INTO system_messages (
          id,
          target_type,
          target_id,
          channel_id,
          body,
          message_type,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      messageId,
      input.targetType,
      input.targetId ?? null,
      input.channelId ?? null,
      input.body.trim(),
      input.messageType ?? "system",
    );
  }

  async listSystemMessagesForActor(actor: SocialActorContext, limit = 50): Promise<readonly ChatMessageDto[]> {
    const rows = await this.db.all<
      Array<{
        id: string;
        target_type: "profile" | "channel" | "admins";
        target_id: string | null;
        channel_id: string | null;
        body: string;
        message_type: "system" | "motd" | "moderation";
        created_at: string;
      }>
    >(
      `
        SELECT id, target_type, target_id, channel_id, body, message_type, created_at
        FROM system_messages
        WHERE (
          (target_type = 'profile' AND target_id = ?)
          OR (target_type = 'admins' AND ? = 'admin')
          OR (target_type = 'channel' AND channel_id IN (
            SELECT id FROM chat_channels_v2 WHERE type = 'system'
          ))
        )
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `,
      actor.profileId,
      actor.rank,
      normalizeLimit(limit, 100),
    );

    return rows.reverse().map((row) => ({
      id: row.id,
      channelId: row.channel_id ?? "system",
      channelType: "system",
      body: row.body,
      createdAt: row.created_at,
      messageType: row.message_type,
      sender: buildSystemIdentity(),
    }));
  }

  async appendAdminAuditLog(
    actorProfileId: string,
    targetProfileId: string | undefined,
    actionType: string,
    payload?: unknown,
  ): Promise<void> {
    await this.db.run(
      `
        INSERT INTO admin_audit_log (
          id,
          actor_profile_id,
          target_profile_id,
          action_type,
          payload_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      randomUUID(),
      actorProfileId,
      targetProfileId ?? null,
      actionType,
      payload === undefined ? null : JSON.stringify(payload),
    );
  }

  async getActiveModerationState(profileId: string): Promise<{
    banned: boolean;
    muted: boolean;
    warned: boolean;
  }> {
    const rows = await this.db.all<Array<{ type: string }>>(
      `
        SELECT type
        FROM moderation_actions
        WHERE target_profile_id = ?
          AND active = 1
          AND (
            expires_at IS NULL
            OR datetime(expires_at) > datetime('now')
          )
      `,
      profileId,
    );
    const types = new Set(rows.map((row) => row.type));
    return {
      banned: types.has("ban"),
      muted: types.has("mute"),
      warned: types.has("warn"),
    };
  }

  async isProfileBanned(profileId: string): Promise<boolean> {
    const state = await this.getActiveModerationState(profileId);
    return state.banned;
  }

  async isProfileMuted(profileId: string): Promise<boolean> {
    const state = await this.getActiveModerationState(profileId);
    return state.muted;
  }

  async getProfileIdByCharacterId(characterId: string): Promise<string | null> {
    const row = await this.db.get<{ profile_id: string }>(
      `
        SELECT profile_id
        FROM player_characters
        WHERE id = ?
      `,
      characterId,
    );

    if (row?.profile_id) {
      return row.profile_id;
    }

    const profile = await this.db.get<{ id: string }>(
      `
        SELECT id
        FROM player_profiles
        WHERE id = ?
      `,
      characterId,
    );

    if (profile?.id) {
      return profile.id;
    }

    const allowedPlayer = await this.db.get<{ player_uuid: string }>(
      `
        SELECT player_uuid
        FROM allowed_players
        WHERE player_uuid = ?
      `,
      characterId,
    );

    return allowedPlayer?.player_uuid ?? null;
  }

  private async ensureProfileExists(profileId: string): Promise<void> {
    const row = await this.db.get<{ id: string }>(
      `
        SELECT id
        FROM player_profiles
        WHERE id = ?
      `,
      profileId,
    );

    if (row) {
      return;
    }

    const allowedPlayer = await this.db.get<{
      player_uuid: string;
      display_name: string | null;
    }>(
      `
        SELECT player_uuid, display_name
        FROM allowed_players
        WHERE player_uuid = ?
      `,
      profileId,
    );

    if (!allowedPlayer) {
      throw new Error("target_not_found");
    }

    await this.db.run(
      `
        INSERT INTO player_profiles (id, display_name, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          display_name = COALESCE(player_profiles.display_name, excluded.display_name),
          updated_at = CURRENT_TIMESTAMP
      `,
      allowedPlayer.player_uuid,
      allowedPlayer.display_name,
    );
  }

  private async ensureCharacterExists(
    characterId: string,
    profileId: string,
    characterName?: string,
  ): Promise<void> {
    const existing = await this.db.get<{ id: string }>(
      `
        SELECT id
        FROM player_characters
        WHERE id = ?
      `,
      characterId,
    );

    if (existing) {
      return;
    }

    const fallbackName =
      characterName?.trim() ||
      (await this.db.get<{ display_name: string | null }>(
        `
          SELECT display_name
          FROM player_profiles
          WHERE id = ?
        `,
        profileId,
      ))?.display_name?.trim() ||
      (await this.db.get<{ display_name: string | null }>(
        `
          SELECT display_name
          FROM allowed_players
          WHERE player_uuid = ?
        `,
        characterId,
      ))?.display_name?.trim() ||
      characterId;

    await this.db.run(
      `
        INSERT INTO player_characters (id, profile_id, name, content_binding_json, created_at, updated_at)
        VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      characterId,
      profileId,
      fallbackName,
    );
  }

  async areProfilesFriends(profileAId: string, profileBId: string): Promise<boolean> {
    const row = await this.db.get<{ friend: number }>(
      `
        SELECT 1 AS friend
        FROM friendships
        WHERE (
          (requester_profile_id = ? AND target_profile_id = ?)
          OR (requester_profile_id = ? AND target_profile_id = ?)
        )
          AND status = 'accepted'
        LIMIT 1
      `,
      profileAId,
      profileBId,
      profileBId,
      profileAId,
    );
    return Boolean(row?.friend);
  }

  private async ensureChannel(
    name: string,
    type: ChatChannelType,
    ownerProfileId?: string,
    guildId?: string,
  ): Promise<ChannelRow> {
    const existing = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id, destroyed_at
        FROM chat_channels_v2
        WHERE name = ? AND type = ?
          AND destroyed_at IS NULL
      `,
      name,
      type,
    );

    if (existing) {
      return existing;
    }

    const id = randomUUID();
    await this.db.run(
      `
        INSERT INTO chat_channels_v2 (
          id,
          name,
          type,
          owner_profile_id,
          guild_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      id,
      name,
      type,
      ownerProfileId ?? null,
      guildId ?? null,
    );

    return {
      id,
      name,
      type,
      owner_profile_id: ownerProfileId ?? null,
      guild_id: guildId ?? null,
    };
  }

  private async getAdminNoteById(noteId: string): Promise<AdminProfileNoteDto | null> {
    const row = await this.db.get<{
      id: string;
      target_profile_id: string;
      author_profile_id: string;
      body: string;
      created_at: string;
      updated_at: string;
    }>(
      `
        SELECT id, target_profile_id, author_profile_id, body, created_at, updated_at
        FROM admin_profile_notes
        WHERE id = ?
      `,
      noteId,
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      targetProfileId: row.target_profile_id,
      authorProfileId: row.author_profile_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async createChannel(
    name: string,
    type: ChatChannelType,
    ownerProfileId?: string,
    guildId?: string,
  ): Promise<ChannelRow> {
    const id = randomUUID();
    await this.db.run(
      `
        INSERT INTO chat_channels_v2 (
          id,
          name,
          type,
          owner_profile_id,
          guild_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      id,
      name,
      type,
      ownerProfileId ?? null,
      guildId ?? null,
    );

    return {
      id,
      name,
      type,
      owner_profile_id: ownerProfileId ?? null,
      guild_id: guildId ?? null,
    };
  }

  private async ensureGuildChannel(guildId: string, guildName: string): Promise<ChannelRow> {
    const trimmedGuildName = guildName.trim();
    const name = trimmedGuildName.length > 0 ? trimmedGuildName : `guild:${guildId}`;
    const existing = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id
        FROM chat_channels_v2
        WHERE type = 'guild' AND guild_id = ?
          AND destroyed_at IS NULL
      `,
      guildId,
    );

    if (existing) {
      if (existing.name !== name) {
        await this.db.run(
          `
            UPDATE chat_channels_v2
            SET name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          name,
          existing.id,
        );
        return {
          ...existing,
          name,
        };
      }

      return existing;
    }

    return this.createChannel(name, "guild", undefined, guildId);
  }

  private async getChannelById(channelId: string): Promise<ChannelRow | null> {
    const row = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id, destroyed_at
        FROM chat_channels_v2
        WHERE id = ?
          AND destroyed_at IS NULL
      `,
      channelId,
    );

    return row ?? null;
  }

  private async requireMember(channelId: string, profileId: string): Promise<ChannelMemberRow> {
    const row = await this.db.get<ChannelMemberRow>(
      `
        SELECT channel_id, profile_id, role, banned
        FROM chat_channel_members_v2
        WHERE channel_id = ? AND profile_id = ?
      `,
      channelId,
      profileId,
    );

    if (!row) {
      throw new Error("forbidden");
    }

    if (row.banned) {
      throw new Error("channel_banned");
    }

    return row;
  }

  private async ensureChannelVisibleToActor(
    actor: SocialActorContext,
    channel: ChannelRow,
    forWrite = false,
  ): Promise<void> {
    if (channel.type === "official" || channel.type === "system") {
      return;
    }

    if (channel.type === "admin") {
      if (actor.rank !== "admin") {
        throw new Error("forbidden");
      }
      return;
    }

    if (channel.type === "guild") {
      const membership = await this.db.get<{ guild_id: string }>(
        `
          SELECT guild_id
          FROM guild_members
          WHERE character_id = ?
        `,
        actor.characterId,
      );

      if (!membership || membership.guild_id !== channel.guild_id) {
        throw new Error("forbidden");
      }
      return;
    }

    if (channel.type === "custom") {
      await this.requireMember(channel.id, actor.profileId);
      return;
    }

    if (channel.type === "direct") {
      const conversation = await this.db.get<DirectConversationRow>(
        `
          SELECT id, profile_a_id, profile_b_id, updated_at
          FROM direct_conversations
          WHERE id = ?
        `,
        channel.id,
      );

      if (
        !conversation ||
        (conversation.profile_a_id !== actor.profileId &&
          conversation.profile_b_id !== actor.profileId)
      ) {
        throw new Error("forbidden");
      }

      if (forWrite && actor.chatAccess !== "allowed") {
        throw new Error("chat_blocked");
      }
    }
  }

  private async ensureDirectConversation(
    profileAId: string,
    profileBId: string,
  ): Promise<DirectConversationRow> {
    const [left, right] = [profileAId, profileBId].sort((a, b) => a.localeCompare(b));
    const existing = await this.db.get<DirectConversationRow>(
      `
        SELECT id, profile_a_id, profile_b_id, updated_at
        FROM direct_conversations
        WHERE (
          profile_a_id = ? AND profile_b_id = ?
        ) OR (
          profile_a_id = ? AND profile_b_id = ?
        )
      `,
      left,
      right,
      right,
      left,
    );

    if (existing) {
      return existing;
    }

    const id = randomUUID();
    await this.db.run(
      `
        INSERT INTO direct_conversations (
          id,
          profile_a_id,
          profile_b_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      id,
      left,
      right,
    );

    const created = await this.db.get<DirectConversationRow>(
      `
        SELECT id, profile_a_id, profile_b_id, updated_at
        FROM direct_conversations
        WHERE id = ?
      `,
      id,
    );

    if (!created) {
      throw new Error("conversation_create_failed");
    }

    return created;
  }

  private async isEitherBlocked(profileAId: string, profileBId: string): Promise<boolean> {
    const row = await this.db.get<{ blocked: number }>(
      `
        SELECT 1 AS blocked
        FROM blocked_profiles
        WHERE (blocker_profile_id = ? AND blocked_profile_id = ?)
           OR (blocker_profile_id = ? AND blocked_profile_id = ?)
        LIMIT 1
      `,
      profileAId,
      profileBId,
      profileBId,
      profileAId,
    );

    return Boolean(row?.blocked);
  }

  private async resolveProfileByCharacterOrProfileName(query: string): Promise<string | null> {
    const normalized = query.trim();

    if (!normalized) {
      return null;
    }

    const profile = await this.db.get<{ id: string }>(
      `
        SELECT id
        FROM player_profiles
        WHERE lower(COALESCE(display_name, '')) = lower(?)
        LIMIT 1
      `,
      normalized,
    );

    if (profile) {
      return profile.id;
    }

    const character = await this.db.get<{ profile_id: string }>(
      `
        SELECT profile_id
        FROM player_characters
        WHERE lower(name) = lower(?)
        LIMIT 1
      `,
      normalized,
    );

    return character?.profile_id ?? null;
  }

  private async getIdentity(
    profileId: string,
    characterId?: string,
    viewerProfileId?: string,
  ): Promise<SocialIdentityDto> {
    const profile = await this.db.get<{
      id: string;
      display_name: string | null;
    }>(
      `
        SELECT id, display_name
        FROM player_profiles
        WHERE id = ?
      `,
      profileId,
    );

    const character = characterId
      ? await this.db.get<{ id: string; name: string }>(
          `
            SELECT id, name
            FROM player_characters
            WHERE id = ?
          `,
          characterId,
        )
      : await this.db.get<{ id: string; name: string }>(
          `
            SELECT id, name
            FROM player_characters
            WHERE profile_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
          `,
          profileId,
        );

    const presence = await this.db.get<{
      online: number;
      last_online_at: string | null;
      profile_display_name: string | null;
      current_character_name: string | null;
    }>(
      `
        SELECT online, last_online_at, profile_display_name, current_character_name
        FROM player_presence
        WHERE profile_id = ?
      `,
      profileId,
    );

    const allowedPlayer = await this.db.get<{
      display_name: string | null;
      rank: "player" | "vip" | "moderator" | "admin";
    }>(
      `
        SELECT display_name, rank
        FROM allowed_players
        WHERE player_uuid = ?
        LIMIT 1
      `,
      character?.id ?? profileId,
    );

    const guildRole = character
      ? await this.db.get<{ role: string; short_name: string | null }>(
          `
            SELECT guild_members.role, guilds.short_name
            FROM guild_members
            INNER JOIN guilds ON guilds.id = guild_members.guild_id
            WHERE character_id = ?
          `,
          character.id,
        )
      : null;

    const badges = buildBadges({
      rank: allowedPlayer?.rank ?? "player",
      guildRole: guildRole?.role,
      isFriend:
        viewerProfileId !== undefined && viewerProfileId !== profileId
          ? await this.areProfilesFriends(viewerProfileId, profileId)
          : false,
    });

    return {
      profileId,
      characterId: character?.id,
      characterName:
        character?.name ??
        presence?.current_character_name ??
        allowedPlayer?.display_name ??
        undefined,
      profileDisplayName:
        profile?.display_name ??
        presence?.profile_display_name ??
        allowedPlayer?.display_name ??
        undefined,
      guildShortName: guildRole?.short_name ?? undefined,
      online: Boolean(presence?.online),
      lastOnlineAt: presence?.last_online_at ?? undefined,
      badges,
    };
  }
}

function normalizeChannelName(name: string): string {
  return name.trim();
}

function normalizeGuildShortName(value: string): string {
  return value.trim().toUpperCase();
}

function validateCustomChannelName(name: string): void {
  if (!name) {
    throw new Error("invalid_channel_name");
  }

  if (name.length > 32) {
    throw new Error("invalid_channel_name");
  }

  if (/\s/u.test(name)) {
    throw new Error("invalid_channel_name");
  }

  if (RESERVED_CHANNEL_NAMES.has(name.toLowerCase())) {
    throw new Error("reserved_channel_name");
  }
}

function normalizeBody(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > 500) {
    return null;
  }

  return normalized;
}

function normalizeLimit(value: number, max: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    return Math.min(50, max);
  }

  return Math.min(value, max);
}

function looksLikeIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function resolveActiveTimeout(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const timeout = Date.parse(value);

  if (Number.isNaN(timeout)) {
    return null;
  }

  return timeout > Date.now() ? value : null;
}

function buildBadges(input: {
  rank: "player" | "vip" | "moderator" | "admin";
  guildRole?: string;
  isFriend?: boolean;
}): readonly SocialBadgeDto[] {
  const badges: SocialBadgeDto[] = [];

  if (input.isFriend) {
    badges.push({
      type: "friend",
      label: "Friend",
    });
  }

  if (input.guildRole) {
    badges.push({
      type: "guild_role",
      label: input.guildRole,
    });
  }

  if (input.rank === "admin") {
    badges.push({
      type: "admin",
      label: "Admin",
    });
  } else if (input.rank === "moderator") {
    badges.push({
      type: "moderation",
      label: "Moderator",
    });
  } else if (input.rank === "vip") {
    badges.push({
      type: "permission",
      label: "VIP",
    });
  }

  return badges;
}

function buildSystemIdentity(): SocialIdentityDto {
  return {
    profileId: "system",
    profileDisplayName: "System",
    characterName: "System",
    online: true,
    badges: [
      {
        type: "permission",
        label: "System",
      },
    ],
  };
}
