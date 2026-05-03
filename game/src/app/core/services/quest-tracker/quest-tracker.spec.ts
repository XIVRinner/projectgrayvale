import { Injector, runInInjectionContext } from "@angular/core";
import { samplePlayer, type Delta, type Quest } from "@rinner/grayvale-core";

import { CharacterRosterService } from "../character-roster.service";
import { QuestTracker } from "./quest-tracker";

describe("QuestTracker", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("completes an attribute quest from an attribute delta", () => {
    const { tracker } = createFixture();

    tracker.loadActiveQuests([
      {
        id: "quest_vitality",
        objectives: [
          {
            type: "attribute_reached",
            attribute: "vitality",
            target: 10
          }
        ]
      }
    ]);

    tracker.processDelta({
      type: "set",
      target: "player",
      path: ["attributes", "vitality"],
      value: 10
    });

    expect(tracker.getState()).toEqual([
      {
        questId: "quest_vitality",
        objectives: {
          "quest_vitality:0": {
            current: 10,
            target: 10,
            completed: true
          }
        },
        completed: true
      }
    ]);
  });

  it("accumulates item collection progress across multiple add deltas", () => {
    const { tracker } = createFixture();

    tracker.loadActiveQuests([
      {
        id: "quest_hides",
        objectives: [
          {
            type: "item_collected",
            itemId: "monster_hide",
            quantity: 10
          }
        ]
      }
    ]);

    tracker.processDelta(createInventoryAddDelta("monster_hide", 3));
    tracker.processDelta(createInventoryAddDelta("monster_hide", 4));
    tracker.processDelta(createInventoryAddDelta("monster_hide", 3));

    expect(tracker.getState()[0]).toEqual({
      questId: "quest_hides",
      objectives: {
        "quest_hides:0": {
          current: 10,
          target: 10,
          completed: true
        }
      },
      completed: true
    });
  });

  it("keeps composite AND quests incomplete until all child objectives are done", () => {
    const { tracker } = createFixture();

    tracker.loadActiveQuests([createAndQuest()]);

    tracker.processDelta(createKillDelta("monster", 10));

    expect(tracker.getState()[0]).toEqual({
      questId: "quest_monster",
      objectives: {
        "quest_monster:0": {
          current: 1,
          target: 2,
          completed: false
        },
        "quest_monster:0.0": {
          current: 10,
          target: 10,
          completed: true
        },
        "quest_monster:0.1": {
          current: 0,
          target: 10,
          completed: false
        }
      },
      completed: false
    });

    tracker.processDelta(createInventoryAddDelta("monster_hide", 10));

    expect(tracker.getState()[0]?.completed).toBe(true);
    expect(tracker.getState()[0]?.objectives["quest_monster:0"]).toEqual({
      current: 2,
      target: 2,
      completed: true
    });
  });

  it("completes composite OR quests when one child objective finishes", () => {
    const { tracker } = createFixture();

    tracker.loadActiveQuests([
      {
        id: "quest_choice",
        objectives: [
          {
            type: "composite",
            operator: "OR",
            objectives: [
              {
                type: "kill",
                target: "wolf",
                count: 3
              },
              {
                type: "item_collected",
                itemId: "wolf_pelt",
                quantity: 3
              }
            ]
          }
        ]
      }
    ]);

    tracker.processDelta(createKillDelta("wolf", 3));

    expect(tracker.getState()[0]).toEqual({
      questId: "quest_choice",
      objectives: {
        "quest_choice:0": {
          current: 1,
          target: 1,
          completed: true
        },
        "quest_choice:0.0": {
          current: 3,
          target: 3,
          completed: true
        },
        "quest_choice:0.1": {
          current: 0,
          target: 3,
          completed: false
        }
      },
      completed: true
    });
  });

  it("tracks kill objectives incrementally from delta metadata", () => {
    const { tracker } = createFixture();

    tracker.loadActiveQuests([
      {
        id: "quest_hunt",
        objectives: [
          {
            type: "kill",
            target: "goblin",
            count: 5
          }
        ]
      }
    ]);

    tracker.processDelta(createKillDelta("goblin", 2));
    tracker.processDelta(createKillDelta("goblin", 2));
    tracker.processDelta(createKillDelta("goblin", 1));

    expect(tracker.getState()[0]).toEqual({
      questId: "quest_hunt",
      objectives: {
        "quest_hunt:0": {
          current: 5,
          target: 5,
          completed: true
        }
      },
      completed: true
    });
  });

  it("tracks activity duration objectives from delta metadata", () => {
    const { tracker } = createFixture();

    tracker.loadActiveQuests([
      {
        id: "quest_logging",
        objectives: [
          {
            type: "activity_duration",
            activityId: "woodcutting",
            duration: 5
          }
        ]
      }
    ]);

    tracker.processDelta(createActivityDelta("woodcutting", 2));
    tracker.processDelta(createActivityDelta("woodcutting", 3));

    expect(tracker.getState()[0]).toEqual({
      questId: "quest_logging",
      objectives: {
        "quest_logging:0": {
          current: 5,
          target: 5,
          completed: true
        }
      },
      completed: true
    });
  });

  it("subscribes to the roster delta pipeline and emits quest updates", () => {
    const { roster, tracker } = createFixture();
    const progressUpdates: string[] = [];
    const completedQuestIds: string[] = [];

    tracker.loadActiveQuests([
      {
        id: "quest_pipeline",
        objectives: [
          {
            type: "item_collected",
            itemId: "ore_chunk",
            quantity: 2
          }
        ]
      }
    ]);

    tracker.questProgress$.subscribe((state) => {
      progressUpdates.push(`${state.questId}:${state.completed ? "done" : "progress"}`);
    });
    tracker.questCompleted$.subscribe((questId) => {
      completedQuestIds.push(questId);
    });

    roster.createCharacter(clonePlayer(samplePlayer));
    roster.applyActiveCharacterDeltas([
      createInventoryAddDelta("ore_chunk", 1),
      createInventoryAddDelta("ore_chunk", 1)
    ]);

    expect(tracker.getState()[0]).toEqual({
      questId: "quest_pipeline",
      objectives: {
        "quest_pipeline:0": {
          current: 2,
          target: 2,
          completed: true
        }
      },
      completed: true
    });
    expect(progressUpdates).toEqual([
      "quest_pipeline:progress",
      "quest_pipeline:done"
    ]);
    expect(completedQuestIds).toEqual(["quest_pipeline"]);
  });
});

function createFixture(): {
  roster: CharacterRosterService;
  tracker: QuestTracker;
} {
  const roster = new CharacterRosterService();
  const injector = Injector.create({
    providers: [{ provide: CharacterRosterService, useValue: roster }]
  });

  return {
    roster,
    tracker: runInInjectionContext(injector, () => new QuestTracker())
  };
}

function createInventoryAddDelta(itemId: string, quantity: number): Delta {
  return {
    type: "add",
    target: "player",
    path: ["inventory", "items", itemId],
    value: quantity
  };
}

function createKillDelta(target: string, count: number): Delta {
  return {
    type: "add",
    target: "player",
    path: ["interactionState", "totalButtonPresses"],
    value: 0,
    meta: {
      questSignal: {
        type: "kill",
        target,
        count
      }
    }
  };
}

function createActivityDelta(activityId: string, duration: number): Delta {
  return {
    type: "add",
    target: "player",
    path: ["interactionState", "totalButtonPresses"],
    value: 0,
    meta: {
      questSignal: {
        type: "activity_duration",
        activityId,
        duration
      }
    }
  };
}

function createAndQuest(): Quest {
  return {
    id: "quest_monster",
    objectives: [
      {
        type: "composite",
        operator: "AND",
        objectives: [
          {
            type: "kill",
            target: "monster",
            count: 10
          },
          {
            type: "item_collected",
            itemId: "monster_hide",
            quantity: 10
          }
        ]
      }
    ]
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
