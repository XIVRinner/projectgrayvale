import { applyDelta, type GameState } from "../delta";
import type { Player } from "../models";
import {
  isQuestCompleted,
  isQuestStepCompleted,
  type QuestLog
} from "./index";

const createPlayer = (): Player => ({
  id: "player_quest_test",
  name: "Quest Test Player",
  description: "A player used for quest tests.",
  race: "human",
  raceId: "race_human",
  jobClass: "wanderer",
  progression: {
    level: 1,
    experience: 0
  },
  adventurerRank: 1,
  attributes: {
    strength: 5
  },
  skills: {
    mining: 2
  },
  inventory: {
    items: {}
  },
  equippedItems: {}
});

const createQuestLog = (): QuestLog => ({
  quests: {}
});

describe("quest log delta compatibility", () => {
  it("initializes a quest entry", () => {
    const state: GameState = {
      player: createPlayer(),
      npcs: {}
    };

    expect(
      applyDelta(state, {
        type: "set",
        target: "player",
        path: ["questLog", "quests", "quest_intro"],
        value: {
          currentStep: "step_1",
          status: "active"
        }
      })
    ).toEqual({
      ...state,
      player: {
        ...state.player,
        questLog: {
          quests: {
            quest_intro: {
              currentStep: "step_1",
              status: "active"
            }
          }
        }
      }
    });
  });

  it("updates the current step", () => {
    const state: GameState = {
      player: {
        ...createPlayer(),
        questLog: {
          quests: {
            quest_intro: {
              currentStep: "step_1",
              status: "active"
            }
          }
        }
      },
      npcs: {}
    };

    expect(
      applyDelta(state, {
        type: "set",
        target: "player",
        path: ["questLog", "quests", "quest_intro", "currentStep"],
        value: "step_2"
      })
    ).toEqual({
      ...state,
      player: {
        ...state.player,
        questLog: {
          quests: {
            quest_intro: {
              currentStep: "step_2",
              status: "active"
            }
          }
        }
      }
    });
  });

  it("marks a quest step list and completion status", () => {
    const state: GameState = {
      player: {
        ...createPlayer(),
        questLog: {
          quests: {
            quest_intro: {
              currentStep: "step_2",
              status: "active"
            }
          }
        }
      },
      npcs: {}
    };

    const withCompletedSteps = applyDelta(state, {
      type: "set",
      target: "player",
      path: ["questLog", "quests", "quest_intro", "completedSteps"],
      value: ["step_1", "step_2"]
    });

    expect(
      applyDelta(withCompletedSteps, {
        type: "set",
        target: "player",
        path: ["questLog", "quests", "quest_intro", "status"],
        value: "completed"
      })
    ).toEqual({
      ...state,
      player: {
        ...state.player,
        questLog: {
          quests: {
            quest_intro: {
              currentStep: "step_2",
              status: "completed",
              completedSteps: ["step_1", "step_2"]
            }
          }
        }
      }
    });
  });
});

describe("quest helpers", () => {
  it("detects completed quests", () => {
    const log: QuestLog = {
      quests: {
        quest_intro: {
          currentStep: "step_2",
          status: "completed",
          completedSteps: ["step_1", "step_2"]
        }
      }
    };

    expect(isQuestCompleted(log, "quest_intro")).toBe(true);
    expect(isQuestCompleted(log, "missing_quest")).toBe(false);
  });

  it("detects completed quest steps", () => {
    const log: QuestLog = {
      quests: {
        quest_intro: {
          currentStep: "step_2",
          status: "active",
          completedSteps: ["step_1"]
        }
      }
    };

    expect(isQuestStepCompleted(log, "quest_intro", "step_1")).toBe(true);
    expect(isQuestStepCompleted(log, "quest_intro", "step_2")).toBe(false);
    expect(isQuestStepCompleted(log, "missing_quest", "step_1")).toBe(false);
  });

  it("returns false for missing steps and an empty log", () => {
    const emptyLog = createQuestLog();
    const log: QuestLog = {
      quests: {
        quest_intro: {
          currentStep: "step_2",
          status: "completed"
        }
      }
    };

    expect(isQuestCompleted(emptyLog, "quest_intro")).toBe(false);
    expect(isQuestStepCompleted(emptyLog, "quest_intro", "step_1")).toBe(false);
    expect(isQuestStepCompleted(log, "quest_intro", "step_1")).toBe(false);
  });
});
