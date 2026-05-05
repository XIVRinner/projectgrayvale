import type { ActorCombatState } from "@rinner/grayvale-core";

/**
 * Returns a new {@link ActorCombatState} with all active cooldowns decremented
 * by one tick. Cooldowns that reach zero are removed from the record.
 *
 * This should be called at the start of each combat tick so that abilities
 * become available again after their cooldown expires.
 */
export function tickCooldowns(state: ActorCombatState): ActorCombatState {
  const next: Record<string, number> = {};
  for (const [abilityId, remaining] of Object.entries(state.cooldowns)) {
    const decremented = remaining - 1;
    if (decremented > 0) {
      next[abilityId] = decremented;
    }
  }
  return { ...state, cooldowns: next };
}
