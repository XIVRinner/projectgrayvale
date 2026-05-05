import { move } from "./graph.logic";
import type { WorldState } from "./graph.types";
import type { CombatNode, CombatNodeResult, CombatRunner } from "./combat-node.types";

/**
 * Executes a {@link CombatNode} by:
 * 1. Calling the injected {@link CombatRunner} with the node's `activityId`.
 * 2. Resolving the branch location from the combat outcome
 *    (`victory` → victory branch, `defeat` → defeat branch,
 *    `fled` → fled branch if defined, otherwise defeat branch).
 * 3. Returning the new {@link WorldState} plus the full {@link CombatNodeResult}.
 *
 * The worldgraph layer never inspects combat internals — it only reads
 * the `outcome` field of the returned delta to determine branching.
 */
export const runCombatNode = (
  node: CombatNode,
  runner: CombatRunner,
  state: WorldState
): CombatNodeResult & { state: WorldState } => {
  const delta = runner(node.activityId);
  const nextLocation =
    delta.outcome === "fled"
      ? (node.branches.fled ?? node.branches.defeat)
      : node.branches[delta.outcome];

  return {
    nextLocation,
    delta,
    state: move(state, nextLocation)
  };
};
