import type { ActorId, AbilityId, EffectId } from "./combat.ids";

export interface CombatLogEntry {
  tick: number;
  type:
    | "prep"
    | "action_selected"
    | "damage"
    | "miss"
    | "dodge"
    | "effect_applied"
    | "effect_tick"
    | "effect_expired"
    | "resource_changed"
    | "cooldown"
    | "death"
    | "outcome";

  actorId?: ActorId;
  targetActorId?: ActorId;
  abilityId?: AbilityId;
  effectId?: EffectId;
  amount?: number;
  message: string;

  debug?: Record<string, unknown>;
}
