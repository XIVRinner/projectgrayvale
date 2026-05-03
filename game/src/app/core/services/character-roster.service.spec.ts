import { samplePlayer } from "@rinner/grayvale-core";

import { CharacterRosterService } from "./character-roster.service";
import { type SaveSlotHealthState } from "./health-balance";
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

    delete player.questLog;
    delete player.story;
    delete player.activityState;

    const slot = roster.createCharacter(player);

    expect(slot.player.story).toEqual({
      currentArcId: "prologue",
      currentChapter: 1
    });
    expect(slot.player.questLog).toEqual({
      quests: {}
    });
    expect(slot.player.activityState).toEqual({
      availability: {},
      activeActivityId: null
    });
  });

  it("defaults vitality unlocked while other attributes and all skills start locked", () => {
    const roster = new CharacterRosterService();

    const slot = roster.createCharacter(clonePlayer(samplePlayer));

    expect(slot.statUnlocks.attributes).toMatchObject({
      vitality: true,
      strength: false,
      agility: false,
      mentality: false
    });
    expect(slot.statUnlocks.skills).toMatchObject({
      short_blade: false,
      bow: false,
      blacksmithing: false
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

  it("defaults missing imported stat unlocks during hydration", () => {
    const roster = new CharacterRosterService();

    roster.importRoster(
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

    expect(roster.activeSlot()?.statUnlocks.attributes.vitality).toBe(true);
    expect(roster.activeSlot()?.statUnlocks.attributes.strength).toBe(false);
    expect(roster.activeSlot()?.statUnlocks.skills.short_blade).toBe(false);
  });

  it("defaults missing imported quest log, story state, and activity availability", () => {
    const roster = new CharacterRosterService();
    const player = clonePlayer(samplePlayer);

    delete player.questLog;
    delete player.story;
    delete player.activityState;

    roster.importRoster(
      JSON.stringify({
        activeSlotId: "slot_1",
        slots: [
          {
            id: "slot_1",
            createdAt: "2026-05-01T08:00:00.000Z",
            updatedAt: "2026-05-01T08:00:00.000Z",
            player
          }
        ]
      })
    );

    expect(roster.activeCharacter()?.questLog).toEqual({
      quests: {}
    });
    expect(roster.activeCharacter()?.story).toEqual({
      currentArcId: "prologue",
      currentChapter: 1
    });
    expect(roster.activeCharacter()?.activityState).toEqual({
      availability: {},
      activeActivityId: null
    });
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

  it("emits centralized world update events when the active world changes", () => {
    const roster = new CharacterRosterService();
    const receivedEvents: Array<{
      previousWorld: { currentLocation: string; sublocations: string[] };
      nextWorld: { currentLocation: string; sublocations: string[] };
    }> = [];

    roster.worldUpdated$.subscribe((event) => {
      receivedEvents.push(event);
    });

    roster.createCharacter(clonePlayer(samplePlayer));
    roster.updateActiveWorld({
      currentLocation: "camp",
      sublocations: []
    });

    expect(receivedEvents).toEqual([
      {
        previousWorld: {
          currentLocation: "village-arkama",
          sublocations: ["chief-house"]
        },
        nextWorld: {
          currentLocation: "camp",
          sublocations: []
        }
      }
    ]);
  });

  it("persists health state through export and import", () => {
    const roster = new CharacterRosterService();
    const health: SaveSlotHealthState = {
      currentHp: 42,
      maxHp: 52
    };

    roster.createCharacter(clonePlayer(samplePlayer), health);

    const payload = roster.exportAll();
    const restoredRoster = new CharacterRosterService();

    restoredRoster.importRoster(payload);

    expect(restoredRoster.activeHealth()).toEqual(health);
  });

  it("persists stat unlock changes through export and import", () => {
    const roster = new CharacterRosterService();

    roster.createCharacter(clonePlayer(samplePlayer));
    roster.setActiveAttributeUnlocked("strength", true);
    roster.setActiveSkillUnlocked("short_blade", true);

    const payload = roster.exportAll();
    const restoredRoster = new CharacterRosterService();

    restoredRoster.importRoster(payload);

    expect(restoredRoster.activeSlot()?.statUnlocks.attributes.strength).toBe(true);
    expect(restoredRoster.activeSlot()?.statUnlocks.skills.short_blade).toBe(true);
  });

  it("persists quest log changes through export and import", () => {
    const roster = new CharacterRosterService();

    roster.createCharacter(clonePlayer(samplePlayer));
    roster.applyActiveCharacterDeltas([
      {
        type: "set",
        target: "player",
        path: ["questLog", "quests", "quest_recovery"],
        value: {
          currentStep: "runtime_objectives",
          status: "active",
          completedSteps: []
        }
      }
    ]);

    const payload = roster.exportAll();
    const restoredRoster = new CharacterRosterService();

    restoredRoster.importRoster(payload);

    expect(restoredRoster.activeCharacter()?.questLog?.quests["quest_recovery"]).toEqual({
      currentStep: "runtime_objectives",
      status: "active",
      completedSteps: []
    });
  });
});

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
