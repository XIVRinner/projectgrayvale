import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { openDatabase, type GrayvaleDatabase } from "../db/database";
import { SocialRepository } from "./social-repository";
import type { SocialActorContext } from "./social-types";

describe("SocialRepository", () => {
  let db: GrayvaleDatabase;
  let repository: SocialRepository;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = `/tmp/grayvale-social-${randomUUID()}.sqlite`;
    db = await openDatabase({
      databaseProvider: "sqlite",
      dbFilePath: dbPath,
    });
    repository = new SocialRepository(db);
  });

  afterEach(async () => {
    await rm(dbPath, { force: true });
  });

  it("seeds official channels", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    const actor = createActor("p1", "c1");

    await repository.ensureOfficialChannels();
    const channels = await repository.listChannelsForActor(actor);

    expect(channels.some((channel) => channel.name === "world")).toBe(true);
    expect(channels.some((channel) => channel.name === "help")).toBe(true);
  });

  it("rejects reserved custom channel names", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    const actor = createActor("p1", "c1");

    await expect(repository.joinCustomChannel(actor, "world")).rejects.toThrow(
      "reserved_channel_name",
    );
  });

  it("prevents custom channel owner from leaving before transfer", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    const actor = createActor("p1", "c1");
    const joined = await repository.joinCustomChannel(actor, "hunters");

    await expect(
      repository.leaveCustomChannel(actor, joined.channel.id),
    ).rejects.toThrow("owner_cannot_leave");
  });

  it("blocks rejoin when actor is banned from custom channel", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    await seedProfile(db, "p2", "c2", "Bob", "player");
    const owner = createActor("p1", "c1");
    const target = createActor("p2", "c2");
    const joined = await repository.joinCustomChannel(owner, "hunters");

    await repository.joinCustomChannel(target, "hunters");
    await repository.kickMember(owner, joined.channel.id, "p2", true);

    await expect(repository.joinCustomChannel(target, "hunters")).rejects.toThrow(
      "channel_banned",
    );
  });

  it("resolves whisper target by character name", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    await seedProfile(db, "p2", "c2", "Bob", "player", "Borin");
    const actor = createActor("p1", "c1", "player", "Alice");

    const result = await repository.sendWhisper(actor, "Borin", "hello");

    expect(result.message.senderProfileId).toBe("p1");
    expect(result.conversationId).toBeTruthy();
  });

  it("prevents whisper when profiles are blocked", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    await seedProfile(db, "p2", "c2", "Bob", "player", "Borin");
    const actor = createActor("p1", "c1", "player", "Alice");

    await repository.setBlockedProfile({
      blockerProfileId: "p2",
      blockedProfileId: "p1",
      blocked: true,
    });

    await expect(repository.sendWhisper(actor, "Borin", "hello")).rejects.toThrow(
      "direct_blocked",
    );
  });

  it("enforces guild invite permission (member cannot invite)", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    await seedProfile(db, "p2", "c2", "Bob", "player");
    await seedProfile(db, "p3", "c3", "Cara", "player");

    const guild = await repository.createGuild({
      actorProfileId: "p1",
      actorCharacterId: "c1",
      name: "Wayfarers",
    });

    await repository.respondGuildInvitation({
      actorProfileId: "p2",
      invitationId: (
        await repository.inviteToGuild({
          guildId: guild.id,
          inviterProfileId: "p1",
          inviterCharacterId: "c1",
          targetProfileId: "p2",
        })
      ).invitationId,
      accept: true,
    });

    await expect(
      repository.inviteToGuild({
        guildId: guild.id,
        inviterProfileId: "p2",
        inviterCharacterId: "c2",
        targetProfileId: "p3",
      }),
    ).rejects.toThrow("guild_invite_forbidden");
  });

  it("sorts admin player list online-first", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "admin");
    await seedProfile(db, "p2", "c2", "Bob", "player");
    await seedProfile(db, "p3", "c3", "Cara", "player");

    await db.run(
      `
        INSERT INTO server_sessions (session_id, player_uuid, client_id, connected_at, last_seen_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      randomUUID(),
      "c2",
      "client-1",
    );

    await db.run(
      `
        UPDATE player_presence
        SET online = 0,
            last_online_at = datetime('now', '-2 day')
        WHERE profile_id = ?
      `,
      "p3",
    );

    const result = await repository.listAdminPlayers({
      page: 1,
      pageSize: 10,
    });

    expect(result.entries[0]?.profileId).toBe("p2");
    expect(result.entries[0]?.online).toBe(true);
    expect(result.entries.some((entry) => entry.profileId === "p3")).toBe(true);
  });

  it("falls back to allowed player names for connected players without profile rows", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "admin");
    await db.run(
      `
        INSERT INTO allowed_players (player_uuid, password_hash, display_name, rank)
        VALUES (?, ?, ?, ?)
      `,
      "legacy-gwen",
      "hash",
      "Gwen",
      "player",
    );
    await db.run(
      `
        INSERT INTO server_sessions (session_id, player_uuid, client_id, connected_at, last_seen_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      randomUUID(),
      "legacy-gwen",
      "client-2",
    );

    const result = await repository.listPlayers(createActor("p1", "c1"), {
      page: 1,
      pageSize: 10,
    });
    const entry = result.entries.find((candidate) => candidate.profileId === "legacy-gwen");

    expect(entry).toMatchObject({
      profileId: "legacy-gwen",
      profileDisplayName: "Gwen",
      currentCharacterName: "Gwen",
      online: true,
    });
    expect(entry?.currentCharacterId).toBeUndefined();
    await expect(repository.getProfileIdByCharacterId("legacy-gwen")).resolves.toBe(
      "legacy-gwen",
    );
  });

  it("creates missing profile rows from allowed players on demand", async () => {
    await seedProfile(db, "p1", "c1", "Alice", "player");
    await db.run(
      `
        INSERT INTO allowed_players (player_uuid, password_hash, display_name, rank)
        VALUES (?, ?, ?, ?)
      `,
      "legacy-target",
      "hash",
      "Gwen",
      "player",
    );

    await repository.setBlockedProfile({
      blockerProfileId: "p1",
      blockedProfileId: "legacy-target",
      blocked: true,
    });

    const createdProfile = await db.get<{ id: string; display_name: string | null }>(
      `
        SELECT id, display_name
        FROM player_profiles
        WHERE id = ?
      `,
      "legacy-target",
    );

    expect(createdProfile).toEqual({
      id: "legacy-target",
      display_name: "Gwen",
    });
  });
});

async function seedProfile(
  db: GrayvaleDatabase,
  profileId: string,
  characterId: string,
  displayName: string,
  rank: "player" | "vip" | "moderator" | "admin",
  characterName = displayName,
): Promise<void> {
  await db.run(
    `
      INSERT INTO player_profiles (id, display_name)
      VALUES (?, ?)
    `,
    profileId,
    displayName,
  );
  await db.run(
    `
      INSERT INTO player_characters (id, profile_id, name)
      VALUES (?, ?, ?)
    `,
    characterId,
    profileId,
    characterName,
  );
  await db.run(
    `
      INSERT INTO allowed_players (player_uuid, password_hash, display_name, rank)
      VALUES (?, ?, ?, ?)
    `,
    characterId,
    "hash",
    displayName,
    rank,
  );
  await db.run(
    `
      INSERT INTO player_presence (
        profile_id,
        profile_display_name,
        current_character_id,
        current_character_name,
        online,
        last_online_at
      )
      VALUES (?, ?, ?, ?, 0, datetime('now', '-1 day'))
      ON CONFLICT(profile_id) DO NOTHING
    `,
    profileId,
    displayName,
    characterId,
    characterName,
  );
}

function createActor(
  profileId: string,
  characterId: string,
  rank: "player" | "vip" | "moderator" | "admin" = "player",
  characterName?: string,
): SocialActorContext {
  return {
    sessionId: randomUUID(),
    profileId,
    characterId,
    rank,
    chatAccess: "allowed",
    characterName,
    profileDisplayName: characterName,
  };
}
