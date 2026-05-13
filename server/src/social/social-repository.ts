import { randomUUID } from "node:crypto";

import type { GrayvaleDatabase } from "../db/database";
import type {
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

interface SessionActorRow {
  readonly session_id: string;
  readonly character_id: string;
  readonly profile_id: string | null;
  readonly character_name: string | null;
  readonly profile_display_name: string | null;
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
      characterName: row.character_name ?? undefined,
      profileDisplayName: row.profile_display_name ?? undefined,
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

    const onlineRows = await this.db.all<
      Array<{
        profile_id: string | null;
        character_id: string;
        character_name: string | null;
        profile_display_name: string | null;
      }>
    >(
      `
        SELECT
          player_characters.profile_id,
          server_sessions.player_uuid AS character_id,
          player_characters.name AS character_name,
          player_profiles.display_name AS profile_display_name
        FROM server_sessions
        LEFT JOIN player_characters
          ON player_characters.id = server_sessions.player_uuid
        LEFT JOIN player_profiles
          ON player_profiles.id = player_characters.profile_id
        WHERE datetime(server_sessions.last_seen_at) >= datetime('now', ?)
      `,
      `-${activeWindowMinutes} minutes`,
    );

    for (const row of onlineRows) {
      const profileId = row.profile_id ?? row.character_id;
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
        profileId,
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
        SELECT guild_id, guild_name
        FROM guild_memberships
        WHERE character_id = ?
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
      const counterpart = await this.getIdentity(counterpartProfileId);
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
        SELECT id, name, type, owner_profile_id, guild_id
        FROM chat_channels_v2
        WHERE lower(name) = lower(?)
          AND type = 'custom'
      `,
      normalized,
    );

    let created = false;
    const channel = existing
      ? existing
      : await this.createChannel(normalized, "custom", actor.profileId);

    if (!existing) {
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
        ? await this.getIdentity(row.sender_profile_id, row.sender_character_id ?? undefined)
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

    await this.ensureChannelVisibleToActor(actor, channel, true);
    const normalizedBody = normalizeBody(body);

    if (!normalizedBody) {
      throw new Error("invalid_chat_message");
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

    const sender = await this.getIdentity(actor.profileId, actor.characterId);
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

    const blocked = await this.isEitherBlocked(actor.profileId, target.profile_id);

    if (blocked) {
      throw new Error("direct_blocked");
    }

    const conversation = await this.ensureDirectConversation(
      actor.profileId,
      target.profile_id,
    );
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

    const sender = await this.getIdentity(actor.profileId, actor.characterId);
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
      const counterpart = await this.getIdentity(counterpartId);
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

    if (blocked) {
      await this.db.run(
        `
          INSERT OR IGNORE INTO social_blocks (
            profile_id,
            target_profile_id,
            created_at
          )
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
        actor.profileId,
        targetProfileId,
      );
      return;
    }

    await this.db.run(
      `
        DELETE FROM social_blocks
        WHERE profile_id = ? AND target_profile_id = ?
      `,
      actor.profileId,
      targetProfileId,
    );
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
        SELECT guild_id, guild_name, role
        FROM guild_memberships
        WHERE profile_id = ?
        ORDER BY joined_at DESC
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

  private async ensureChannel(
    name: string,
    type: ChatChannelType,
    ownerProfileId?: string,
    guildId?: string,
  ): Promise<ChannelRow> {
    const existing = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id
        FROM chat_channels_v2
        WHERE name = ? AND type = ?
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
    const name = `guild:${guildName}`;
    const existing = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id
        FROM chat_channels_v2
        WHERE type = 'guild' AND guild_id = ?
      `,
      guildId,
    );

    if (existing) {
      return existing;
    }

    return this.createChannel(name, "guild", undefined, guildId);
  }

  private async getChannelById(channelId: string): Promise<ChannelRow | null> {
    const row = await this.db.get<ChannelRow>(
      `
        SELECT id, name, type, owner_profile_id, guild_id
        FROM chat_channels_v2
        WHERE id = ?
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
          FROM guild_memberships
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
        FROM social_blocks
        WHERE (profile_id = ? AND target_profile_id = ?)
           OR (profile_id = ? AND target_profile_id = ?)
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

  private async getIdentity(profileId: string, characterId?: string): Promise<SocialIdentityDto> {
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
    }>(
      `
        SELECT online, last_online_at
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

    const guildRole = character
      ? await this.db.get<{ role: string }>(
          `
            SELECT role
            FROM guild_memberships
            WHERE character_id = ?
          `,
          character.id,
        )
      : null;

    const badges = buildBadges({
      rank: rank?.rank ?? "player",
      guildRole: guildRole?.role,
    });

    return {
      profileId,
      characterId: character?.id,
      characterName: character?.name,
      profileDisplayName: profile?.display_name ?? undefined,
      online: Boolean(presence?.online),
      lastOnlineAt: presence?.last_online_at ?? undefined,
      badges,
    };
  }
}

function normalizeChannelName(name: string): string {
  return name.trim();
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
