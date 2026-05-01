import type { NPC, Player } from "@rinner/grayvale-core";

import {
  evaluateGuard,
  evaluateGuards,
  type Guard,
  type GuardContext,
  type GuardResolver,
  type WorldState
} from "../index";

const createPlayer = (): Player => ({
  id: "player_guard_test",
  name: "Guard Test Player",
  description: "A player used for guard tests.",
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
    scouting: 2
  },
  inventory: {
    items: {}
  },
  equippedItems: {}
});

const createNpc = (): NPC => ({
  id: "npc_guard_test",
  name: "Mira",
  description: "A companion used for guard tests.",
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

const createWorldState = (): WorldState => ({
  currentLocation: "town",
  sublocations: []
});

const createContext = (): GuardContext => ({
  player: createPlayer(),
  npcs: {
    npc_guard_test: createNpc()
  },
  world: createWorldState()
});

const resolver: GuardResolver = (guard, context) => {
  if (guard.type === "player_level_at_least") {
    const minLevel = guard.params?.minLevel;

    return (
      typeof minLevel === "number" &&
      context.player.progression.level >= minLevel
    );
  }

  if (guard.type === "current_location_is") {
    const locationId = guard.params?.locationId;

    return (
      typeof locationId === "string" &&
      context.world.currentLocation === locationId
    );
  }

  return false;
};

describe("evaluateGuard", () => {
  it("returns true when the resolver passes the guard", () => {
    const guard: Guard = {
      type: "player_level_at_least",
      params: {
        minLevel: 1
      }
    };

    expect(evaluateGuard(guard, createContext(), resolver)).toBe(true);
  });

  it("returns false when the resolver fails the guard", () => {
    const guard: Guard = {
      type: "player_level_at_least",
      params: {
        minLevel: 10
      }
    };

    expect(evaluateGuard(guard, createContext(), resolver)).toBe(false);
  });

  it("returns false for unknown guards when the resolver does not recognize them", () => {
    const guard: Guard = {
      type: "unknown_guard"
    };

    expect(evaluateGuard(guard, createContext(), resolver)).toBe(false);
  });
});

describe("evaluateGuards", () => {
  it("returns true when no guards are provided", () => {
    expect(evaluateGuards(undefined, createContext(), resolver)).toBe(true);
  });

  it("requires all guards to pass", () => {
    const guards: Guard[] = [
      {
        type: "player_level_at_least",
        params: {
          minLevel: 1
        }
      },
      {
        type: "current_location_is",
        params: {
          locationId: "town"
        }
      }
    ];

    expect(evaluateGuards(guards, createContext(), resolver)).toBe(true);
  });

  it("short-circuits on the first failure", () => {
    const calls: string[] = [];
    const shortCircuitResolver: GuardResolver = (guard) => {
      calls.push(guard.type);

      return guard.type === "first_guard";
    };
    const guards: Guard[] = [
      {
        type: "failing_guard"
      },
      {
        type: "second_guard"
      }
    ];

    expect(evaluateGuards(guards, createContext(), shortCircuitResolver)).toBe(false);
    expect(calls).toEqual(["failing_guard"]);
  });
});
