import type { CombatDelta } from "@rinner/grayvale-core";

/**
 * Maps each possible combat outcome to a target location ID in the world graph.
 * `fled` is optional; when absent, a fled outcome falls back to the `defeat` branch.
 */
export type CombatBranches = {
  victory: string;
  defeat: string;
  fled?: string;
};

/**
 * A graph node that triggers a combat activity and branches to a new location
 * based on the combat outcome.
 *
 * The node knows only the `activityId` and where to route afterwards.
 * All combat internals stay inside `@rinner/grayvale-combat`.
 */
export interface CombatNode {
  activityId: string;
  branches: CombatBranches;
}

/**
 * A caller-supplied function that runs a combat activity by its ID and returns
 * the resulting {@link CombatDelta}.
 *
 * Worldgraph never imports `@rinner/grayvale-combat` directly.
 * The caller provides this runner, keeping combat internals outside the graph layer.
 */
export type CombatRunner = (activityId: string) => CombatDelta;

/**
 * The value returned from {@link runCombatNode}.
 */
export interface CombatNodeResult {
  /** Target location ID resolved from the combat outcome. */
  nextLocation: string;
  /** The full combat delta produced by the runner. */
  delta: CombatDelta;
}
