import type { CombatDelta, CombatOutcome } from "@rinner/grayvale-core";

import { runCombatNode } from "./combat-node.logic";
import type { CombatNode, CombatRunner } from "./combat-node.types";
import type { WorldState } from "./graph.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeState = (location: string): WorldState => ({
  currentLocation: location,
  sublocations: []
});

const makeNode = (fled?: string): CombatNode => ({
  activityId: "activity_coyote_mvp",
  branches: {
    victory: "forest_clearing",
    defeat: "town_inn",
    ...(fled !== undefined ? { fled } : {})
  }
});

const makeRunner = (outcome: CombatOutcome): CombatRunner =>
  (_activityId: string): CombatDelta => ({
    activityId: "activity_coyote_mvp",
    outcome,
    ticksElapsed: 5,
    actorChanges: [],
    resourceChanges: [],
    effectsApplied: [],
    effectsExpired: [],
    xp: [],
    loot: [],
    penalties: [],
    logs: []
  });

// ---------------------------------------------------------------------------
// runCombatNode — basic branching
// ---------------------------------------------------------------------------

describe("runCombatNode", () => {
  it("calls the runner with the node activityId", () => {
    const runner = jest.fn(makeRunner("victory"));
    const node = makeNode();
    const state = makeState("forest_trail");

    runCombatNode(node, runner, state);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith("activity_coyote_mvp");
  });

  it("branches to victory location on victory outcome", () => {
    const result = runCombatNode(makeNode(), makeRunner("victory"), makeState("forest_trail"));

    expect(result.nextLocation).toBe("forest_clearing");
    expect(result.state.currentLocation).toBe("forest_clearing");
  });

  it("branches to defeat location on defeat outcome", () => {
    const result = runCombatNode(makeNode(), makeRunner("defeat"), makeState("forest_trail"));

    expect(result.nextLocation).toBe("town_inn");
    expect(result.state.currentLocation).toBe("town_inn");
  });

  it("branches to explicit fled location when present and outcome is fled", () => {
    const node = makeNode("forest_edge");
    const result = runCombatNode(node, makeRunner("fled"), makeState("forest_trail"));

    expect(result.nextLocation).toBe("forest_edge");
    expect(result.state.currentLocation).toBe("forest_edge");
  });

  it("falls back to defeat location when fled outcome but no fled branch defined", () => {
    const node = makeNode(); // no fled branch
    const result = runCombatNode(node, makeRunner("fled"), makeState("forest_trail"));

    expect(result.nextLocation).toBe("town_inn");
    expect(result.state.currentLocation).toBe("town_inn");
  });

  it("returns the full combat delta", () => {
    const result = runCombatNode(makeNode(), makeRunner("victory"), makeState("forest_trail"));

    expect(result.delta.activityId).toBe("activity_coyote_mvp");
    expect(result.delta.outcome).toBe("victory");
    expect(result.delta.ticksElapsed).toBe(5);
  });

  it("clears the sublocation stack on transition", () => {
    const state: WorldState = { currentLocation: "forest_trail", sublocations: ["brush"] };
    const result = runCombatNode(makeNode(), makeRunner("victory"), state);

    expect(result.state.sublocations).toEqual([]);
  });
});
