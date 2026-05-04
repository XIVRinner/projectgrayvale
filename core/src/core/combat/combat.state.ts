import type { ActorId, AbilityId, EffectId, ResourceId, TagId } from "./combat.ids";

export interface ActorCombatState {
  actorId: ActorId;
  definitionId: ActorId;
  currentHp: number;
  maxHp: number;
  level: number;
  tags: TagId[];

  resources: Record<ResourceId, number>;
  activeEffects: ActiveEffectInstance[];

  cooldowns: Record<AbilityId, number>;

  range: number;
  defeated: boolean;
}

export interface ActiveEffectInstance {
  effectId: EffectId;
  sourceActorId: ActorId;
  targetActorId: ActorId;

  stacks: number;
  remainingTicks?: number;

  metadata?: Record<string, unknown>;
}
