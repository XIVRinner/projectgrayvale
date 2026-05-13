import {
  hydrateMessageAvatars,
  hydrateChannelMessageAvatars,
  mapServerChatMessage,
  selectActiveChannelMessages,
} from "./server-chat.service";

import type {
  ServerChatMessageView,
  ServerPresencePlayerView,
} from "./server-chat.models";

describe("server chat message mapping", () => {
  const player: ServerPresencePlayerView = {
    playerUuid: "char-1",
    displayName: "Aerin",
    avatarPath: "assets/images/portraits/aerin.png",
    rank: "player",
    chatAccess: "allowed",
    chatAccessLabel: "Chat Open",
    serverBanned: false,
    clientId: "client-1",
    connectedAt: "2026-05-13T10:00:00.000Z",
    lastSeenAt: "2026-05-13T10:01:00.000Z",
  };

  it("maps player avatar paths from presence records", () => {
    const entry: Parameters<typeof mapServerChatMessage>[0] = {
      id: "msg-1",
      channelId: "world",
      channelType: "official",
      senderProfileId: "profile-1",
      senderCharacterId: "char-1",
      senderCharacterName: "Aerin",
      body: "Hello there",
      createdAt: "2026-05-13T10:02:00.000Z",
      messageType: "user",
      sender: {
        profileId: "profile-1",
        characterId: "char-1",
        characterName: "Aerin",
        profileDisplayName: "Aerin",
        online: true,
        badges: [],
      },
    };

    expect(mapServerChatMessage(entry, [player]).avatarPath).toBe(
      player.avatarPath,
    );
  });

  it("only backfills missing avatars for player-authored messages", () => {
    const messages: readonly ServerChatMessageView[] = [
      {
        id: "msg-1",
        channelId: "world",
        channelType: "official",
        messageType: "user",
        playerUuid: "char-1",
        displayName: "Aerin",
        rank: "player",
        chatAccess: "allowed",
        chatAccessLabel: "Chat Open",
        serverBanned: false,
        message: "Hello there",
        createdAt: "2026-05-13T10:02:00.000Z",
        sender: {
          profileId: "profile-1",
          characterId: "char-1",
          characterName: "Aerin",
          online: true,
          badges: [],
        },
      },
      {
        id: "msg-2",
        channelId: "system",
        channelType: "system",
        messageType: "system",
        playerUuid: "system",
        displayName: "System",
        rank: "admin",
        chatAccess: "allowed",
        chatAccessLabel: "System",
        serverBanned: false,
        message: "Server restart in 5 minutes.",
        createdAt: "2026-05-13T10:03:00.000Z",
        sender: {
          profileId: "system",
          profileDisplayName: "System",
          online: true,
          badges: [],
        },
      },
    ];

    const hydrated = hydrateMessageAvatars(messages, [player]);

    expect(hydrated[0]?.avatarPath).toBe(player.avatarPath);
    expect(hydrated[1]?.avatarPath).toBeUndefined();
  });

  it("keeps message caches isolated by channel", () => {
    const worldMessage: ServerChatMessageView = {
      id: "msg-world",
      channelId: "world",
      channelType: "official",
      messageType: "user",
      playerUuid: "char-1",
      displayName: "Aerin",
      rank: "player",
      chatAccess: "allowed",
      chatAccessLabel: "Chat Open",
      serverBanned: false,
      message: "World hello",
      createdAt: "2026-05-13T10:02:00.000Z",
      sender: {
        profileId: "profile-1",
        characterId: "char-1",
        characterName: "Aerin",
        online: true,
        badges: [],
      },
    };

    const messagesByChannel = {
      world: [worldMessage],
      "dm-1": [],
    } satisfies Record<string, readonly ServerChatMessageView[]>;

    expect(selectActiveChannelMessages(messagesByChannel, "world")).toEqual([
      worldMessage,
    ]);
    expect(selectActiveChannelMessages(messagesByChannel, "dm-1")).toEqual([]);
    expect(selectActiveChannelMessages(messagesByChannel, "missing")).toEqual([]);
  });

  it("hydrates avatars across cached channels", () => {
    const messagesByChannel = {
      world: [
        {
          id: "msg-world",
          channelId: "world",
          channelType: "official",
          messageType: "user",
          playerUuid: "char-1",
          displayName: "Aerin",
          rank: "player",
          chatAccess: "allowed",
          chatAccessLabel: "Chat Open",
          serverBanned: false,
          message: "World hello",
          createdAt: "2026-05-13T10:02:00.000Z",
          sender: {
            profileId: "profile-1",
            characterId: "char-1",
            characterName: "Aerin",
            online: true,
            badges: [],
          },
        },
      ],
      "dm-1": [
        {
          id: "msg-dm",
          channelId: "dm-1",
          channelType: "direct",
          messageType: "user",
          playerUuid: "char-1",
          displayName: "Aerin",
          rank: "player",
          chatAccess: "allowed",
          chatAccessLabel: "Chat Open",
          serverBanned: false,
          message: "Secret hello",
          createdAt: "2026-05-13T10:03:00.000Z",
          sender: {
            profileId: "profile-1",
            characterId: "char-1",
            characterName: "Aerin",
            online: true,
            badges: [],
          },
        },
      ],
    } satisfies Record<string, readonly ServerChatMessageView[]>;

    const hydrated = hydrateChannelMessageAvatars(messagesByChannel, [player]);

    expect(hydrated["world"]?.[0]?.avatarPath).toBe(player.avatarPath);
    expect(hydrated["dm-1"]?.[0]?.avatarPath).toBe(player.avatarPath);
  });
});
