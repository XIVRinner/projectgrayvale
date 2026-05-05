import type { CombatRunState } from "@rinner/grayvale-core";
import type { CombatRng } from "../rng/combat-rng";
import type { CombatTickContext } from "./tick";
import { runTick } from "./tick";

/**
 * Runs the combat loop to completion by calling {@link runTick} repeatedly
 * until the phase reaches "ended" or the safety limit is hit.
 *
 * @param initial  The initial {@link CombatRunState} produced by
 *                 {@link createInitialCombatState}.
 * @param context  Definitions and rotations for this encounter.
 * @param rng      Random number generator (inject {@link TestCombatRng} for
 *                 deterministic tests).
 * @param maxTicks Maximum ticks before the loop is aborted (default 200).
 *                 Prevents infinite loops in case of a misconfigured encounter.
 * @returns The final {@link CombatRunState} with phase "ended" and an outcome,
 *          or the state at `maxTicks` if the limit was reached.
 */
export function runCombat(
  initial: CombatRunState,
  context: CombatTickContext,
  rng: CombatRng,
  maxTicks = 200
): CombatRunState {
  let state = initial;
  while (state.phase !== "ended" && state.currentTick < maxTicks) {
    state = runTick(state, context, rng);
  }
  return state;
}
