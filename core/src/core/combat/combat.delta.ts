import type { ActivityId, ActorId, ResourceId, EffectId, ItemId, SkillId } from "./combat.ids";
import type { CombatLogEntry } from "./combat.log";

export type CombatOutcome = "victory" | "defeat" | "fled";

export interface ActorDelta {
  actorId: ActorId;
  hpChange?: number;
  defeated?: boolean;
}

export interface ResourceDelta {
  actorId: ActorId;
  resourceId: ResourceId;
  amount: number;
}

export interface EffectDelta {
  effectId: EffectId;
  sourceActorId: ActorId;
  targetActorId: ActorId;
  stacks?: number;
}

export interface XpDelta {
  targetActorId: ActorId;
  xpType: "character" | "skill";
  skillId?: SkillId;
  amount: number;
  reason: string;
}

export interface LootDelta {
  itemId: ItemId;
  quantity: number;
}

export interface PenaltyDelta {
  targetActorId: ActorId;
  penaltyType: "death_attack_lockout";
  durationSeconds: number;
}

export interface CombatDelta {
  activityId: ActivityId;
  outcome: CombatOutcome;
  ticksElapsed: number;

  actorChanges: ActorDelta[];
  resourceChanges: ResourceDelta[];
  effectsApplied: EffectDelta[];
  effectsExpired: EffectDelta[];
  xp: XpDelta[];
  loot: LootDelta[];
  penalties: PenaltyDelta[];
  logs: CombatLogEntry[];
}
