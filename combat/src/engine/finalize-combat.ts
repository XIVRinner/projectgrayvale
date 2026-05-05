import type { CombatRunState, CombatDelta } from "@rinner/grayvale-core";

/**
 * Converts a completed {@link CombatRunState} into a {@link CombatDelta} that
 * can be applied to the player's persistent game state.
 *
 * The state **must** be in phase "ended" with a defined outcome; if it is not,
 * the function throws rather than return a partial result.
 *
 * All per-tick log entries accumulated during the run are included verbatim in
 * the returned delta's `logs` array so that callers (e.g. the game log service)
 * can replay or display them.
 */
export function finalizeCombat(state: CombatRunState): CombatDelta {
  if (state.phase !== "ended" || state.outcome === undefined) {
    throw new Error(
      `finalizeCombat called on a non-ended combat (phase: ${state.phase})`
    );
  }

  const { accumulatedDelta } = state;

  return {
    activityId: state.activityId,
    outcome: state.outcome,
    // currentTick is incremented at the end of every runTick call, so it equals
    // the total number of ticks that ran during this combat.
    ticksElapsed: state.currentTick,
    actorChanges: accumulatedDelta.actorChanges,
    resourceChanges: accumulatedDelta.resourceChanges,
    effectsApplied: accumulatedDelta.effectsApplied,
    effectsExpired: accumulatedDelta.effectsExpired,
    xp: accumulatedDelta.xp,
    loot: accumulatedDelta.loot,
    penalties: accumulatedDelta.penalties,
    logs: state.logs,
  };
}
