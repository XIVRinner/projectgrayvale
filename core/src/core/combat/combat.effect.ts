import type { EffectId, TagId } from "./combat.ids";
import type { DamageType } from "./combat.damage";

export interface EffectModifier {
  target: "damage_done" | "damage_taken" | "dodge_chance";
  operation: "add" | "multiply";
  value: number;
  damageType?: DamageType;
}

export interface EffectDefinition {
  id: EffectId;
  displayName: string;
  tags: TagId[];

  effectType: "buff" | "debuff" | "dot" | "resource_stack";

  durationTicks?: number;
  maxStacks?: number;
  sourceSpecific?: boolean;

  tickTiming?: "start_of_tick";

  damageOverTime?: {
    damageType: DamageType;
    scaling: {
      type: "percent_of_last_piercing_damage" | "flat";
      value: number;
    };
  };

  modifiers?: EffectModifier[];
}
