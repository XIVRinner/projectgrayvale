import type { AbilityId, EffectId, TagId } from "./combat.ids";
import type { DamagePacket } from "./combat.damage";
import type { ResourceChange } from "./combat.resource";

export type TargetRule =
  | "self"
  | "enemy"
  | "main_target"
  | "current_target";

export interface EffectApplicationDefinition {
  effectId: EffectId;
  chance?: number;
  stacks?: number;
  target: TargetRule;
}

/** Declares that using this ability spends stacks of an active effect. */
export interface EffectSpendDefinition {
  effectId: EffectId;
  stacks: number;
  target: TargetRule;
}

export interface AbilityDefinition {
  id: AbilityId;
  displayName: string;
  tags: TagId[];

  abilityType: "attack" | "buff" | "heal" | "defensive" | "reaction" | "movement";

  damagePackets?: DamagePacket[];

  cooldownTicks?: number;
  castTicks?: number;

  resourceCosts?: ResourceChange[];
  resourceGains?: ResourceChange[];

  appliesEffects?: EffectApplicationDefinition[];

  /** Effect stacks spent (consumed) when this ability is used. */
  spendsEffects?: EffectSpendDefinition[];

  targetRule: TargetRule;

  consumesAction?: boolean;
  isReaction?: boolean;
}
