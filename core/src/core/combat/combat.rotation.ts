import type { AbilityId, EffectId, SkillId } from "./combat.ids";

export type RotationCondition = {
  type: "effect_stacks_gte";
  effectId: EffectId;
  threshold: number;
};

export interface RotationActionRule {
  abilityId: AbilityId;
  condition?: RotationCondition;
  isFallback?: boolean;
}

export interface CompiledRotation {
  skillId: SkillId;
  rules: RotationActionRule[];
}
