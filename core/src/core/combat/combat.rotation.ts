import type { AbilityId, EffectId, SkillId } from "./combat.ids";

export type RotationCondition =
  | {
      type: "effect_stacks_gte";
      effectId: EffectId;
      threshold: number;
    }
  | {
      type: "ability_not_on_cooldown";
      abilityId: AbilityId;
    };

export interface RotationActionRule {
  abilityId: AbilityId;
  condition?: RotationCondition;
  isFallback?: boolean;
}

export interface CompiledRotation {
  skillId: SkillId;
  rules: RotationActionRule[];
  /** Ability to trigger as a free reaction when this actor dodges an attack. */
  onDodgeReactionAbilityId?: AbilityId;
}
