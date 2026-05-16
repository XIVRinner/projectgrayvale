import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { openDatabase, type GrayvaleDatabase } from "../db/database";
import { PlayerProfileRepository } from "./player-profile-repository";

describe("PlayerProfileRepository", () => {
  let db: GrayvaleDatabase;
  let repository: PlayerProfileRepository;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = `/tmp/grayvale-player-profile-${randomUUID()}.sqlite`;
    db = await openDatabase({
      databaseProvider: "sqlite",
      dbFilePath: dbPath,
    });
    repository = new PlayerProfileRepository(db);
  });

  afterEach(async () => {
    await rm(dbPath, { force: true }).catch(() => undefined);
  });

  it("creates character ids separately from the owning profile id", async () => {
    const profileId = randomUUID();
    await repository.upsertProfile(profileId, "Mark");

    const created = await repository.createCharacter(profileId, "Aryn", null);

    expect(created.profileId).toBe(profileId);
    expect(created.id).not.toBe(profileId);

    const summary = await repository.getProfileSummary(profileId);
    expect(summary?.characters).toEqual([
      expect.objectContaining({
        id: created.id,
        profileId,
        name: "Aryn",
      }),
    ]);
  });

  it("registers a client-created character id for the owning profile", async () => {
    const profileId = randomUUID();
    const characterId = randomUUID();

    const result = await repository.registerCharacter(
      profileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
        level: 12,
        locationId: "sunfall-docks",
        lastLocationName: "Sunfall Docks",
      },
      null,
    );

    expect(result.status).toBe("created");
    expect(result.character).toEqual(
      expect.objectContaining({
        id: characterId,
        profileId,
        name: "Aryn",
        portraitShardId: "human:warm:0",
        level: 12,
        locationId: "sunfall-docks",
        lastLocationName: "Sunfall Docks",
      }),
    );
  });

  it("treats repeated registration for the same profile and character as a refresh", async () => {
    const profileId = randomUUID();
    const characterId = randomUUID();

    await repository.registerCharacter(
      profileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
      },
      null,
    );

    const result = await repository.registerCharacter(
      profileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
        level: 20,
        locationId: "ivory-market",
        lastLocationName: "Ivory Market",
      },
      null,
    );

    expect(result.status).toBe("refreshed");
    expect(result.character).toEqual(
      expect.objectContaining({
        id: characterId,
        level: 20,
        locationId: "ivory-market",
        lastLocationName: "Ivory Market",
      }),
    );
  });

  it("rejects a character id already registered to another profile on the same server", async () => {
    const firstProfileId = randomUUID();
    const secondProfileId = randomUUID();
    const characterId = randomUUID();

    await repository.registerCharacter(
      firstProfileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
      },
      null,
    );

    await expect(
      repository.registerCharacter(
        secondProfileId,
        {
          characterId,
          characterName: "Aryn",
          portraitShardId: "human:warm:0",
        },
        null,
      ),
    ).rejects.toThrow("character_profile_conflict");
  });

  it("rejects name mismatches as tamper evidence", async () => {
    const profileId = randomUUID();
    const characterId = randomUUID();

    await repository.registerCharacter(
      profileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
      },
      null,
    );

    await expect(
      repository.registerCharacter(
        profileId,
        {
          characterId,
          characterName: "Not Aryn",
          portraitShardId: "human:warm:0",
        },
        null,
      ),
    ).rejects.toThrow("character_tamper_detected");
  });

  it("activates only characters already registered to the same profile", async () => {
    const profileId = randomUUID();
    const characterId = randomUUID();

    await repository.registerCharacter(
      profileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
      },
      null,
    );

    const activated = await repository.registerActiveCharacter(profileId, characterId, {
      level: 7,
      locationId: "riverwatch",
      lastLocationName: "Riverwatch",
    });

    expect(activated).toEqual(
      expect.objectContaining({
        id: characterId,
        level: 7,
        locationId: "riverwatch",
        lastLocationName: "Riverwatch",
      }),
    );
  });

  it("rejects active registration for characters not registered to the profile", async () => {
    const profileId = randomUUID();

    await expect(
      repository.registerActiveCharacter(profileId, randomUUID(), {
        level: 7,
      }),
    ).rejects.toThrow("character_not_registered");
  });

  it("deletes only the matching profile character roster entry", async () => {
    const profileId = randomUUID();
    const otherProfileId = randomUUID();
    const characterId = randomUUID();
    const otherCharacterId = randomUUID();

    await repository.registerCharacter(
      profileId,
      {
        characterId,
        characterName: "Aryn",
        portraitShardId: "human:warm:0",
      },
      null,
    );
    await repository.registerCharacter(
      otherProfileId,
      {
        characterId: otherCharacterId,
        characterName: "Bram",
        portraitShardId: "human:cool:1",
      },
      null,
    );

    await expect(repository.deleteCharacter(profileId, characterId)).resolves.toBe(true);
    await expect(repository.getCharacter(characterId)).resolves.toBeNull();
    await expect(repository.getCharacter(otherCharacterId)).resolves.toEqual(
      expect.objectContaining({
        id: otherCharacterId,
        profileId: otherProfileId,
      }),
    );
  });
});
