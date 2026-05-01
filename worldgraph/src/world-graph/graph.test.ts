import {
  canMove,
  enterSublocation,
  hasSublocation,
  leaveSublocation,
  move,
  type GuardContext,
  type GuardResolver,
  type WorldGraph,
  type WorldState
} from "../index";

const createGraph = (): WorldGraph => ({
  locations: {
    town: {
      id: "town",
      sublocations: ["square", "inn"]
    },
    forest: {
      id: "forest",
      sublocations: ["grove"],
      guards: [
        {
          type: "location_access",
          params: {
            allowed: true
          }
        }
      ]
    },
    ruins: {
      id: "ruins"
    }
  },
  edges: [
    {
      from: "town",
      to: "forest",
      guards: [
        {
          type: "edge_access",
          params: {
            allowed: true
          }
        }
      ]
    },
    {
      from: "forest",
      to: "ruins"
    }
  ]
});

const createState = (): WorldState => ({
  currentLocation: "town",
  sublocations: ["square"]
});

const createContext = (): GuardContext => ({
  player: {
    id: "player_graph_test",
    name: "Graph Test Player",
    description: "A player used for graph tests.",
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
  world: createState()
});

const resolver: GuardResolver = (guard) => {
  if (guard.type === "edge_access" || guard.type === "location_access") {
    return guard.params?.allowed === true;
  }

  return false;
};

describe("canMove", () => {
  it("returns true when a matching edge exists", () => {
    expect(canMove(createGraph(), "forest", "ruins")).toBe(true);
  });

  it("returns false when no matching edge exists", () => {
    expect(canMove(createGraph(), "town", "ruins")).toBe(false);
  });

  it("allows movement when edge and location guards pass", () => {
    expect(
      canMove(createGraph(), "town", "forest", createContext(), resolver)
    ).toBe(true);
  });

  it("blocks movement when an edge guard fails", () => {
    const graph = createGraph();

    graph.edges[0] = {
      ...graph.edges[0],
      guards: [
        {
          type: "edge_access",
          params: {
            allowed: false
          }
        }
      ]
    };

    expect(
      canMove(graph, "town", "forest", createContext(), resolver)
    ).toBe(false);
  });

  it("blocks movement when a location guard fails", () => {
    const graph = createGraph();

    graph.locations.forest = {
      ...graph.locations.forest,
      guards: [
        {
          type: "location_access",
          params: {
            allowed: false
          }
        }
      ]
    };

    expect(
      canMove(graph, "town", "forest", createContext(), resolver)
    ).toBe(false);
  });

  it("blocks movement for guarded edges when context or resolver is missing", () => {
    expect(canMove(createGraph(), "town", "forest")).toBe(false);
  });

  it("returns false for unknown guards when the resolver does not recognize them", () => {
    const graph = createGraph();

    graph.edges[0] = {
      ...graph.edges[0],
      guards: [
        {
          type: "unknown_guard"
        }
      ]
    };

    expect(
      canMove(graph, "town", "forest", createContext(), resolver)
    ).toBe(false);
  });
});

describe("move", () => {
  it("updates the current location and clears sublocations", () => {
    const state = createState();

    expect(move(state, "forest")).toEqual({
      currentLocation: "forest",
      sublocations: []
    });
  });

  it("returns a new immutable state object", () => {
    const state = createState();
    const result = move(state, "forest");

    expect(result).not.toBe(state);
    expect(result.sublocations).not.toBe(state.sublocations);
    expect(state).toEqual({
      currentLocation: "town",
      sublocations: ["square"]
    });
  });
});

describe("sublocation helpers", () => {
  it("detects authored sublocations by location id", () => {
    const graph = createGraph();

    expect(hasSublocation(graph, "town", "square")).toBe(true);
    expect(hasSublocation(graph, "town", "grove")).toBe(false);
    expect(hasSublocation(graph, "missing", "square")).toBe(false);
  });

  it("pushes a sublocation immutably", () => {
    const state = createState();
    const result = enterSublocation(state, "inn_room");

    expect(result).toEqual({
      currentLocation: "town",
      sublocations: ["square", "inn_room"]
    });
    expect(result).not.toBe(state);
    expect(result.sublocations).not.toBe(state.sublocations);
  });

  it("pops the last sublocation immutably", () => {
    const state: WorldState = {
      currentLocation: "town",
      sublocations: ["square", "inn_room"]
    };
    const result = leaveSublocation(state);

    expect(result).toEqual({
      currentLocation: "town",
      sublocations: ["square"]
    });
    expect(result).not.toBe(state);
    expect(result.sublocations).not.toBe(state.sublocations);
  });

  it("safely leaves when there are no sublocations", () => {
    const state: WorldState = {
      currentLocation: "town",
      sublocations: []
    };

    expect(leaveSublocation(state)).toBe(state);
  });
});
