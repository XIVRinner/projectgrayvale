import { samplePlayer } from "@rinner/grayvale-core";

import { CharacterRosterService } from "./character-roster.service";
import { cloneSaveSlotWorldState, DEFAULT_SAVE_SLOT_WORLD_STATE } from "./world-state.models";

describe("CharacterRosterService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("seeds new characters with the default world state", () => {
    const roster = new CharacterRosterService();

    const slot = roster.createCharacter(clonePlayer(samplePlayer));

    expect(slot.world).toEqual(DEFAULT_SAVE_SLOT_WORLD_STATE);
    expect(roster.activeWorld()).toEqual(DEFAULT_SAVE_SLOT_WORLD_STATE);
  });

  it("seeds new characters with prologue story state and empty activity availability", () => {
    const roster = new CharacterRosterService();
    const player = clonePlayer(samplePlayer);

    delete player.story;
    delete player.activityState;

    const slot = roster.createCharacter(player);

    expect(slot.player.story).toEqual({
      currentArcId: "prologue",
      currentChapter: 1
    });
    expect(slot.player.activityState).toEqual({
      availability: {},
      activeActivityId: null
    });
  });

  it("defaults missing imported world state during hydration", () => {
    const roster = new CharacterRosterService();

    const importedCount = roster.importRoster(
      JSON.stringify({
        activeSlotId: "slot_1",
        slots: [
          {
            id: "slot_1",
            createdAt: "2026-05-01T08:00:00.000Z",
            updatedAt: "2026-05-01T08:00:00.000Z",
            player: clonePlayer(samplePlayer)
          }
        ]
      })
    );

    expect(importedCount).toBe(1);
    expect(roster.activeWorld()).toEqual(DEFAULT_SAVE_SLOT_WORLD_STATE);
  });

  it("round-trips world state through export and import", () => {
    const roster = new CharacterRosterService();

    roster.createCharacter(clonePlayer(samplePlayer));
    roster.updateActiveWorld(
      cloneSaveSlotWorldState({
        currentLocation: "camp",
        sublocations: []
      })
    );

    const payload = roster.exportAll();
    const restoredRoster = new CharacterRosterService();

    restoredRoster.importRoster(payload);

    expect(restoredRoster.activeWorld()).toEqual({
      currentLocation: "camp",
      sublocations: []
    });
  });
});

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
