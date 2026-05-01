import type { Delta } from "@rinner/grayvale-core";

import {
  collectMoveActions,
  dispatchActions,
  resolveMoveDeltas,
  type Action,
  type ActionRegistry,
  type GuardContext,
  type GuardResolver,
  type WorldGraph
} from "../index";

const createContext = (): GuardContext => ({
  player: {
    id: "player_action_test",
    name: "Action Test Player",
    description: "A player used for action tests.",
    raceId: "human",
    jobClass: "wanderer",
    progression: {
      level: 1,
      experience: 0
    },
    adventurerRank: 1,
    attributes: {},
    skills: {},
    inventory: {
      items: {}
    },
    equippedItems: {}
  },
  npcs: {},
  world: {
    currentLocation: "town",
    sublocations: []
  }
});

const resolver: GuardResolver = (guard) => {
  if (guard.type === "allow") {
    return true;
  }

  if (guard.type === "deny") {
    return false;
  }

  return false;
};

const createDelta = (path: string, value: number): Delta => ({
  type: "add",
  target: "player",
  path: [path],
  value
});

const createActionGraph = (): WorldGraph => ({
  locations: {
    town: {
      id: "town"
    },
    forest: {
      id: "forest",
      rules: [
        {
          actions: [
            {
              type: "grant_gold",
              params: {
                amount: 5
              }
            }
          ]
        }
      ]
    }
  },
  edges: [
    {
      from: "town",
      to: "forest",
      guards: [
        {
          type: "allow"
        }
      ],
      rules: [
        {
          guards: [
            {
              type: "allow"
            }
          ],
          actions: [
            {
              type: "grant_xp",
              params: {
                amount: 10
              }
            }
          ]
        }
      ]
    }
  ]
});

describe("dispatchActions", () => {
  it("calls the matching handler for an action type", () => {
    const context = createContext();
    const action: Action = {
      type: "grant_xp",
      params: {
        amount: 10
      }
    };
    const handler = jest.fn(() => [createDelta("progression.experience", 10)]);
    const registry: ActionRegistry = {
      grant_xp: handler
    };

    const deltas = dispatchActions([action], context, registry);

    expect(handler).toHaveBeenCalledWith(action, context);
    expect(deltas).toEqual([createDelta("progression.experience", 10)]);
  });

  it("combines deltas from multiple actions", () => {
    const context = createContext();
    const registry: ActionRegistry = {
      grant_xp: () => [createDelta("progression.experience", 10)],
      grant_gold: () => [createDelta("inventory.gold", 5)]
    };

    const deltas = dispatchActions(
      [
        {
          type: "grant_xp",
          params: {
            amount: 10
          }
        },
        {
          type: "grant_gold",
          params: {
            amount: 5
          }
        }
      ],
      context,
      registry
    );

    expect(deltas).toEqual([
      createDelta("progression.experience", 10),
      createDelta("inventory.gold", 5)
    ]);
  });

  it("safely ignores unknown actions", () => {
    const context = createContext();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const registry: ActionRegistry = {
      grant_xp: () => [createDelta("progression.experience", 10)]
    };

    const deltas = dispatchActions(
      [
        {
          type: "unknown_action"
        },
        {
          type: "grant_xp"
        }
      ],
      context,
      registry
    );

    expect(deltas).toEqual([createDelta("progression.experience", 10)]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("world graph action integration", () => {
  it("collects actions after movement rule evaluation and dispatches deltas", () => {
    const graph = createActionGraph();
    const context = createContext();
    const registry: ActionRegistry = {
      grant_xp: () => [createDelta("progression.experience", 10)],
      grant_gold: () => [createDelta("inventory.gold", 5)]
    };

    expect(
      collectMoveActions(graph, "town", "forest", context, resolver)
    ).toEqual([
      {
        type: "grant_xp",
        params: {
          amount: 10
        }
      },
      {
        type: "grant_gold",
        params: {
          amount: 5
        }
      }
    ]);

    expect(
      resolveMoveDeltas(graph, "town", "forest", context, resolver, registry)
    ).toEqual([
      createDelta("progression.experience", 10),
      createDelta("inventory.gold", 5)
    ]);
  });

  it("returns no actions or deltas when movement rules fail", () => {
    const graph = createActionGraph();
    const context: GuardContext = {
      ...createContext(),
      world: {
        currentLocation: "town",
        sublocations: []
      }
    };
    const failingResolver: GuardResolver = (guard) => guard.type === "deny";
    const registry: ActionRegistry = {
      grant_xp: () => [createDelta("progression.experience", 10)],
      grant_gold: () => [createDelta("inventory.gold", 5)]
    };

    expect(
      collectMoveActions(graph, "town", "forest", context, failingResolver)
    ).toEqual([]);
    expect(
      resolveMoveDeltas(
        graph,
        "town",
        "forest",
        context,
        failingResolver,
        registry
      )
    ).toEqual([]);
  });
});