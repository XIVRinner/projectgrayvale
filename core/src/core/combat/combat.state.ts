import type { ActorId, AbilityId, EffectId, ResourceId, TagId, ActivityId } from "./combat.ids";
import type { CombatOutcome, ActorDelta, ResourceDelta, EffectDelta, XpDelta, LootDelta, PenaltyDelta } from "./combat.delta";
import type { CombatLogEntry } from "./combat.log";
import type { ResistanceProfile, ImmunityProfile } from "./combat.resistance";

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

  resistances?: ResistanceProfile;
  immunities?: ImmunityProfile;
}

export interface ActiveEffectInstance {
  effectId: EffectId;
  sourceActorId: ActorId;
  targetActorId: ActorId;

  stacks: number;
  remainingTicks?: number;

  metadata?: Record<string, unknown>;
}

export type CombatPhase = "prep" | "combat" | "ended";

export interface CombatDeltaAccumulator {
  actorChanges: ActorDelta[];
  resourceChanges: ResourceDelta[];
  effectsApplied: EffectDelta[];
  effectsExpired: EffectDelta[];
  xp: XpDelta[];
  loot: LootDelta[];
  penalties: PenaltyDelta[];
}

export interface CombatRunState {
  activityId: ActivityId;
  currentTick: number;
  phase: CombatPhase;
  outcome?: CombatOutcome;

  actors: Record<ActorId, ActorCombatState>;

  logs: CombatLogEntry[];
  accumulatedDelta: CombatDeltaAccumulator;
}
