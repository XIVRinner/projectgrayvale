import type {
  ActorCombatState,
  AbilityId,
  CompiledRotation,
  RotationCondition
} from "@rinner/grayvale-core";

function evaluateCondition(
  condition: RotationCondition,
  actorState: ActorCombatState
): boolean {
  if (condition.type === "effect_stacks_gte") {
    const instance = actorState.activeEffects.find(
      (e) => e.effectId === condition.effectId
    );
    return (instance?.stacks ?? 0) >= condition.threshold;
  }
  if (condition.type === "ability_not_on_cooldown") {
    return (actorState.cooldowns[condition.abilityId] ?? 0) === 0;
  }
  return false;
}

/**
 * Selects the next ability to use given a {@link CompiledRotation} and the
 * current actor state.
 *
 * Rules are evaluated in priority order. The first rule whose condition is
 * satisfied (or which has no condition) is selected. If no rule matches,
 * `ability_auto_attack` is returned as a guaranteed fallback.
 */
export function selectNextAction(
  compiled: CompiledRotation,
  actorState: ActorCombatState
): AbilityId {
  for (const rule of compiled.rules) {
    if (
      rule.condition === undefined ||
      evaluateCondition(rule.condition, actorState)
    ) {
      return rule.abilityId;
    }
  }
  return "ability_auto_attack";
}
