import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { openDatabase, type GrayvaleDatabase } from "../db/database";
import { MultiplayerRepository } from "./multiplayer-repository";

describe("MultiplayerRepository", () => {
  let db: GrayvaleDatabase;
  let repository: MultiplayerRepository;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = `/tmp/grayvale-multiplayer-${randomUUID()}.sqlite`;
    db = await openDatabase({
      databaseProvider: "sqlite",
      dbFilePath: dbPath,
    });
    repository = new MultiplayerRepository(db);
  });

  afterEach(async () => {
    await rm(dbPath, { force: true }).catch(() => undefined);
  });

  it("stores profile and active character separately on sessions", async () => {
    const profileId = randomUUID();
    const activeCharacterId = randomUUID();

    await repository.registerPlayer(profileId, "secret", "Mark");
    await db.run(
      `
        INSERT INTO player_characters (id, profile_id, name, created_at, updated_at, last_played_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      activeCharacterId,
      profileId,
      "Aryn",
    );

    const session = await repository.createSession(
      profileId,
      "client-1",
      activeCharacterId,
      "127.0.0.1",
    );

    expect(session.profileId).toBe(profileId);
    expect(session.activeCharacterId).toBe(activeCharacterId);
  });
});
