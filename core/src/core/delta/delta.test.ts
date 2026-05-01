import type { Player } from "../models";
import type { NPC } from "../npc";
import { applyDelta, applyDeltas, type Delta, type GameState } from "./index";

const createPlayer = (): Player => ({
  id: "player_delta_test",
  name: "Delta Test Player",
  description: "A player used for delta application tests.",
  race: "human",
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

const createNpc = (): NPC => ({
  id: "npc_1",
  name: "Mira",
  description: "A companion used for delta application tests.",
  type: "combat",
  skills: {
    swordsmanship: 3
  },
  attributes: {
    vitality: 4
  },
  progression: {
    level: 2,
    adventurerRank: 1
  },
  trust: 15,
  trustCap: 100,
  starLevel: 1,
  role: "dps",
  equipment: {
    mainHand: "training_blade"
  }
});

const createState = (): GameState => ({
  player: createPlayer(),
  npcs: {
    npc_1: createNpc()
  }
});

describe("applyDelta", () => {
  describe("player updates", () => {
    it("adds skill xp via path", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "add",
          target: "player",
          path: ["skills", "mining"],
          value: 3
        })
      ).toEqual({
        ...state,
        player: {
          ...state.player,
          skills: {
            mining: 5
          }
        }
      });
    });

    it("applies attribute changes via path", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "add",
          target: "player",
          path: ["attributes", "strength"],
          value: -2
        })
      ).toEqual({
        ...state,
        player: {
          ...state.player,
          attributes: {
            strength: 3
          }
        }
      });
    });
  });

  describe("npc updates", () => {
    it("updates trust", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "set",
          target: "npc",
          targetId: "npc_1",
          path: ["trust"],
          value: 100
        })
      ).toEqual({
        ...state,
        npcs: {
          npc_1: {
            ...state.npcs.npc_1,
            trust: 100
          }
        }
      });
    });

    it("updates equipment", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "set",
          target: "npc",
          targetId: "npc_1",
          path: ["equipment", "mainHand"],
          value: "iron_sword"
        })
      ).toEqual({
        ...state,
        npcs: {
          npc_1: {
            ...state.npcs.npc_1,
            equipment: {
              ...state.npcs.npc_1.equipment,
              mainHand: "iron_sword"
            }
          }
        }
      });
    });

    it("updates progression values", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "add",
          target: "npc",
          targetId: "npc_1",
          path: ["progression", "level"],
          value: 1
        })
      ).toEqual({
        ...state,
        npcs: {
          npc_1: {
            ...state.npcs.npc_1,
            progression: {
              ...state.npcs.npc_1.progression,
              level: 3
            }
          }
        }
      });
    });
  });

  describe("nested paths", () => {
    it("creates deep missing objects for player updates", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "set",
          target: "player",
          path: ["inventory", "items", "ore", "count"],
          value: 4
        })
      ).toEqual({
        ...state,
        player: {
          ...state.player,
          inventory: {
            items: {
              ore: {
                count: 4
              }
            }
          }
        }
      });
    });

    it("creates missing nested values for add operations", () => {
      const state = createState();

      expect(
        applyDelta(state, {
          type: "add",
          target: "npc",
          targetId: "npc_1",
          path: ["skills", "short_blade"],
          value: 0.2
        })
      ).toEqual({
        ...state,
        npcs: {
          npc_1: {
            ...state.npcs.npc_1,
            skills: {
              ...state.npcs.npc_1.skills,
              short_blade: 0.2
            }
          }
        }
      });
    });
  });

  describe("immutability", () => {
    it("preserves reference equality for unchanged branches", () => {
      const state = createState();
      const result = applyDelta(state, {
        type: "set",
        target: "npc",
        targetId: "npc_1",
        path: ["trust"],
        value: 50
      });

      expect(result).not.toBe(state);
      expect(result.player).toBe(state.player);
      expect(result.npcs).not.toBe(state.npcs);
      expect(result.npcs.npc_1).not.toBe(state.npcs.npc_1);
      expect(result.npcs.npc_1.progression).toBe(state.npcs.npc_1.progression);
      expect(result.npcs.npc_1.skills).toBe(state.npcs.npc_1.skills);
    });
  });

  describe("errors", () => {
    it("throws when the path is empty", () => {
      const state = createState();

      expect(() =>
        applyDelta(state, {
          type: "set",
          target: "player",
          path: [],
          value: 1
        })
      ).toThrow("Delta path cannot be empty.");
    });

    it("throws when add is used on a non-number", () => {
      const state = createState();

      expect(() =>
        applyDelta(state, {
          type: "add",
          target: "npc",
          targetId: "npc_1",
          path: ["equipment", "mainHand"],
          value: 1
        })
      ).toThrow('Delta type "add" can only be used on numeric values.');
    });

    it("throws when npc targetId is missing", () => {
      const state = createState();

      expect(() =>
        applyDelta(state, {
          type: "set",
          target: "npc",
          path: ["trust"],
          value: 10
        })
      ).toThrow('NPC deltas require a "targetId".');
    });

    it("throws for invalid targets at runtime", () => {
      const state = createState();

      expect(() =>
        applyDelta(state, {
          type: "set",
          target: "monster" as Delta["target"],
          path: ["hp"],
          value: 10
        })
      ).toThrow("Invalid delta target: monster");
    });
  });
});

describe("applyDeltas", () => {
  it("applies multiple deltas in order", () => {
    const state = createState();

    expect(
      applyDeltas(state, [
        {
          type: "add",
          target: "player",
          path: ["skills", "mining"],
          value: 3
        },
        {
          type: "set",
          target: "npc",
          targetId: "npc_1",
          path: ["equipment", "mainHand"],
          value: "iron_sword"
        },
        {
          type: "add",
          target: "npc",
          targetId: "npc_1",
          path: ["trust"],
          value: 5
        }
      ])
    ).toEqual({
      player: {
        ...state.player,
        skills: {
          mining: 5
        }
      },
      npcs: {
        npc_1: {
          ...state.npcs.npc_1,
          trust: 20,
          equipment: {
            ...state.npcs.npc_1.equipment,
            mainHand: "iron_sword"
          }
        }
      }
    });
  });
});
