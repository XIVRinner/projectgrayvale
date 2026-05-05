import type {
  CombatRunState,
  CombatActivityDefinition,
  AbilityDefinition,
  EffectDefinition,
  CompiledRotation,
  ActorCombatState,
  ActorId,
  AbilityId,
  ActiveEffectInstance,
  CombatLogEntry,
  ActorDelta,
  EffectDelta,
  CombatPhase,
  CombatOutcome,
} from "@rinner/grayvale-core";
import type { CombatRng } from "../rng/combat-rng";
import { tickCooldowns } from "./tick-cooldowns";
import { selectNextAction } from "../rotation/rotation-selector";

/**
 * Lookup tables and per-actor compiled rotations required to run a tick.
 */
export interface CombatTickContext {
  activity: CombatActivityDefinition;
  /** All ability definitions referenced by actors in this encounter. */
  abilities: Record<string, AbilityDefinition>;
  /** All effect definitions referenced by abilities or active effects. */
  effects: Record<string, EffectDefinition>;
  /** Compiled rotation for each actor, keyed by actorId. */
  rotations: Record<ActorId, CompiledRotation>;
}

// ---------------------------------------------------------------------------
// Internal accumulator
// ---------------------------------------------------------------------------

interface TickAccumulator {
  logs: CombatLogEntry[];
  actorDeltas: ActorDelta[];
  effectsApplied: EffectDelta[];
  effectsExpired: EffectDelta[];
}

function newAccumulator(): TickAccumulator {
  return { logs: [], actorDeltas: [], effectsApplied: [], effectsExpired: [] };
}

// ---------------------------------------------------------------------------
// Step 2 — Cooldowns
// ---------------------------------------------------------------------------

function tickAllCooldowns(
  actors: Record<ActorId, ActorCombatState>
): Record<ActorId, ActorCombatState> {
  const result: Record<ActorId, ActorCombatState> = {};
  for (const [id, actor] of Object.entries(actors)) {
    result[id] = tickCooldowns(actor);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Steps 4+5 — DOT resolution + death check from dots
// ---------------------------------------------------------------------------

function resolveDotsAndTickEffects(
  actors: Record<ActorId, ActorCombatState>,
  tick: number,
  effectDefs: Record<string, EffectDefinition>,
  acc: TickAccumulator
): Record<ActorId, ActorCombatState> {
  const result = { ...actors };

  for (const actorId of Object.keys(result)) {
    let actor = result[actorId];
    const keptEffects: ActiveEffectInstance[] = [];
    let hpDelta = 0;

    for (const instance of actor.activeEffects) {
      const effectDef = effectDefs[instance.effectId];
      if (!effectDef) {
        keptEffects.push(instance);
        continue;
      }

      let expired = false;
      let updatedInstance = { ...instance };

      // DOT tick
      if (
        effectDef.effectType === "dot" &&
        effectDef.tickTiming === "start_of_tick" &&
        effectDef.damageOverTime
      ) {
        const dot = effectDef.damageOverTime;
        let basePerStack = 0;
        if (dot.scaling.type === "flat") {
          basePerStack = dot.scaling.value;
        } else if (dot.scaling.type === "percent_of_last_piercing_damage") {
          const stored = instance.metadata?.dotBaseAmount;
          const base = typeof stored === "number" ? stored : 0;
          basePerStack = Math.round(base * dot.scaling.value);
        }
        const totalDamage = basePerStack * updatedInstance.stacks;
        if (totalDamage > 0) {
          hpDelta -= totalDamage;
          acc.actorDeltas.push({ actorId, hpChange: -totalDamage });
          acc.logs.push({
            tick,
            type: "effect_tick",
            actorId,
            effectId: instance.effectId,
            amount: totalDamage,
            message: `${actorId} takes ${totalDamage} ${dot.damageType} damage from ${effectDef.displayName}`,
          });
        }
      }

      // Tick down duration
      if (effectDef.durationTicks !== undefined) {
        const remaining = (updatedInstance.remainingTicks ?? effectDef.durationTicks) - 1;
        if (remaining <= 0) {
          expired = true;
          acc.effectsExpired.push({
            effectId: instance.effectId,
            sourceActorId: instance.sourceActorId,
            targetActorId: actorId,
            stacks: instance.stacks,
          });
          acc.logs.push({
            tick,
            type: "effect_expired",
            actorId,
            effectId: instance.effectId,
            message: `${effectDef.displayName} expired on ${actorId}`,
          });
        } else {
          updatedInstance = { ...updatedInstance, remainingTicks: remaining };
        }
      }

      if (!expired) {
        keptEffects.push(updatedInstance);
      }
    }

    if (hpDelta !== 0) {
      actor = { ...actor, currentHp: actor.currentHp + hpDelta };
    }

    result[actorId] = { ...actor, activeEffects: keptEffects };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Death marking
// ---------------------------------------------------------------------------

function markDefeated(
  actors: Record<ActorId, ActorCombatState>,
  tick: number,
  acc: TickAccumulator
): Record<ActorId, ActorCombatState> {
  const result = { ...actors };
  for (const [actorId, actor] of Object.entries(result)) {
    if (!actor.defeated && actor.currentHp <= 0) {
      result[actorId] = { ...actor, defeated: true };
      acc.actorDeltas.push({ actorId, defeated: true });
      acc.logs.push({
        tick,
        type: "death",
        actorId,
        message: `${actorId} has been defeated`,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Combat-end check
// ---------------------------------------------------------------------------

interface CombatEndResult {
  phase: "ended";
  outcome: CombatOutcome;
}

/**
 * Returns the combat-end result when one side is fully defeated, or null if
 * combat should continue.
 *
 * Player defeat takes priority over mutual defeat: if both sides die
 * simultaneously the outcome is always "defeat".
 */
function checkCombatEnd(
  actors: Record<ActorId, ActorCombatState>,
  activity: CombatActivityDefinition
): CombatEndResult | null {
  const playerActor = actors[activity.playerActorId];
  const enemyActors = activity.enemyActorIds
    .map((id) => actors[id])
    .filter(Boolean);

  if (playerActor?.defeated) {
    return { phase: "ended", outcome: "defeat" };
  }

  if (enemyActors.length > 0 && enemyActors.every((e) => e.defeated)) {
    return { phase: "ended", outcome: "victory" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step 6 — Action selection
// ---------------------------------------------------------------------------

function selectActionsForAll(
  actors: Record<ActorId, ActorCombatState>,
  context: CombatTickContext
): Record<ActorId, AbilityId> {
  const selected: Record<ActorId, AbilityId> = {};
  for (const [actorId, actor] of Object.entries(actors)) {
    if (actor.defeated) continue;
    const rotation = context.rotations[actorId];
    if (!rotation) continue;
    selected[actorId] = selectNextAction(rotation, actor);
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Steps 7–10 — Simultaneous action resolution
// ---------------------------------------------------------------------------

function getMainTarget(
  actorId: ActorId,
  activity: CombatActivityDefinition,
  actors: Record<ActorId, ActorCombatState>
): ActorId | null {
  if (actorId === activity.playerActorId) {
    for (const enemyId of activity.enemyActorIds) {
      if (!actors[enemyId]?.defeated) return enemyId;
    }
    return null;
  }
  const player = actors[activity.playerActorId];
  return player && !player.defeated ? activity.playerActorId : null;
}

function computeDamageMultiplier(
  attackerEffects: ActiveEffectInstance[],
  defenderEffects: ActiveEffectInstance[],
  damageType: string,
  effectDefs: Record<string, EffectDefinition>
): number {
  let multiplier = 1.0;

  for (const instance of attackerEffects) {
    const def = effectDefs[instance.effectId];
    if (!def?.modifiers) continue;
    for (const mod of def.modifiers) {
      if (mod.target !== "damage_done") continue;
      if (mod.damageType && mod.damageType !== damageType) continue;
      if (mod.operation === "multiply") multiplier *= mod.value;
    }
  }

  for (const instance of defenderEffects) {
    const def = effectDefs[instance.effectId];
    if (!def?.modifiers) continue;
    for (const mod of def.modifiers) {
      if (mod.target !== "damage_taken") continue;
      if (mod.damageType && mod.damageType !== damageType) continue;
      if (mod.operation === "multiply") {
        for (let s = 0; s < instance.stacks; s++) {
          multiplier *= mod.value;
        }
      }
    }
  }

  return multiplier;
}

/**
 * Applies an effect to a target actor, respecting maxStacks and refreshing
 * duration. Returns the updated actor.
 */
function applyEffectToActor(
  target: ActorCombatState,
  targetId: ActorId,
  sourceId: ActorId,
  effectDef: EffectDefinition,
  stacks: number,
  dotBaseAmount: number,
  acc: TickAccumulator,
  tick: number
): ActorCombatState {
  const isPercentPiercing =
    effectDef.damageOverTime?.scaling.type === "percent_of_last_piercing_damage";

  const existing = target.activeEffects.find((e) => {
    if (e.effectId !== effectDef.id) return false;
    if (effectDef.sourceSpecific && e.sourceActorId !== sourceId) return false;
    return true;
  });

  acc.effectsApplied.push({
    effectId: effectDef.id,
    sourceActorId: sourceId,
    targetActorId: targetId,
    stacks,
  });

  if (existing) {
    const newStacks = Math.min(
      existing.stacks + stacks,
      effectDef.maxStacks ?? Infinity
    );
    acc.logs.push({
      tick,
      type: "effect_applied",
      actorId: targetId,
      effectId: effectDef.id,
      message: `${effectDef.displayName} refreshed on ${targetId} (${newStacks} stacks)`,
    });
    const updatedEffects = target.activeEffects.map((e) => {
      if (e !== existing) return e;
      return {
        ...e,
        stacks: newStacks,
        remainingTicks: effectDef.durationTicks ?? e.remainingTicks,
        metadata: isPercentPiercing
          ? { ...e.metadata, dotBaseAmount }
          : e.metadata,
      };
    });
    return { ...target, activeEffects: updatedEffects };
  }

  acc.logs.push({
    tick,
    type: "effect_applied",
    actorId: targetId,
    effectId: effectDef.id,
    message: `${effectDef.displayName} applied to ${targetId}`,
  });
  const instance: ActiveEffectInstance = {
    effectId: effectDef.id,
    sourceActorId: sourceId,
    targetActorId: targetId,
    stacks: Math.min(stacks, effectDef.maxStacks ?? Infinity),
    remainingTicks: effectDef.durationTicks,
    metadata: isPercentPiercing ? { dotBaseAmount } : undefined,
  };
  return { ...target, activeEffects: [...target.activeEffects, instance] };
}

/** Updates dotBaseAmount in any percent_of_last_piercing_damage DOTs on an actor. */
function updatePiercingDotBase(
  actor: ActorCombatState,
  piercingAmount: number,
  effectDefs: Record<string, EffectDefinition>
): ActorCombatState {
  const updated = actor.activeEffects.map((instance) => {
    const def = effectDefs[instance.effectId];
    if (
      def?.effectType === "dot" &&
      def.damageOverTime?.scaling.type === "percent_of_last_piercing_damage"
    ) {
      return { ...instance, metadata: { ...instance.metadata, dotBaseAmount: piercingAmount } };
    }
    return instance;
  });
  return { ...actor, activeEffects: updated };
}

/**
 * Resolves all selected actions simultaneously.
 *
 * Damage is computed from the pre-action actor states so that two actors can
 * kill each other in the same tick.  Effects are then applied after all damage
 * has landed.
 */
function resolveActions(
  actors: Record<ActorId, ActorCombatState>,
  selectedActions: Record<ActorId, AbilityId>,
  context: CombatTickContext,
  rng: CombatRng,
  tick: number,
  acc: TickAccumulator
): Record<ActorId, ActorCombatState> {
  interface AttackOutcome {
    sourceId: ActorId;
    targetId: ActorId;
    abilityId: AbilityId;
    totalDamage: number;
    piercingDamage: number;
    miss: boolean;
    dodged: boolean;
  }

  // First pass: roll all damage using pre-action states; check dodge before damage calculation
  const attacks: AttackOutcome[] = [];
  for (const [actorId, abilityId] of Object.entries(selectedActions)) {
    const actor = actors[actorId];
    if (actor.defeated) continue;

    const ability = context.abilities[abilityId];
    if (!ability || ability.abilityType !== "attack" || !ability.damagePackets?.length) {
      continue;
    }

    const targetId = getMainTarget(actorId, context.activity, actors);
    if (!targetId) continue;
    const target = actors[targetId];
    if (!target || target.defeated) continue;

    // Dodge check — evaluated before damage rolls
    const dodgeChance = target.dodgeChance ?? 0;
    if (dodgeChance > 0 && rng.chance(dodgeChance)) {
      attacks.push({ sourceId: actorId, targetId, abilityId, totalDamage: 0, piercingDamage: 0, miss: false, dodged: true });
      continue;
    }

    let totalDamage = 0;
    let piercingDamage = 0;
    for (const packet of ability.damagePackets) {
      // Immunity check: immune damage types contribute 0 damage
      if (target.immunities?.[packet.damageType]) {
        continue;
      }

      const base = rng.rollInt(packet.interval.min, packet.interval.max);
      const mult = computeDamageMultiplier(
        actor.activeEffects,
        target.activeEffects,
        packet.damageType,
        context.effects
      );
      const afterMult = Math.round(base * mult);

      // Apply flat resistance reduction; clamp each packet at 0 so high
      // resistance to one damage type cannot cancel other packets' damage.
      const resistance = target.resistances?.[packet.damageType] ?? 0;
      const dmg = Math.max(0, afterMult - resistance);

      totalDamage += dmg;
      if (packet.damageType === "piercing" && dmg > 0) piercingDamage += dmg;
    }

    const miss = totalDamage <= 0;
    attacks.push({ sourceId: actorId, targetId, abilityId, totalDamage, piercingDamage, miss, dodged: false });
  }

  // Second pass: apply all damage simultaneously; handle dodge outcomes
  let result = { ...actors };
  for (const atk of attacks) {
    if (atk.dodged) {
      // Dodge negates all damage and adds +1 range to the dodging actor
      const dodger = result[atk.targetId];
      result[atk.targetId] = { ...dodger, range: dodger.range + 1 };
      acc.logs.push({
        tick,
        type: "dodge",
        actorId: atk.targetId,
        targetActorId: atk.sourceId,
        abilityId: atk.abilityId,
        message: `${atk.targetId} dodges ${atk.abilityId} from ${atk.sourceId} (+1 range)`,
      });
    } else if (atk.miss) {
      acc.logs.push({
        tick,
        type: "miss",
        actorId: atk.sourceId,
        targetActorId: atk.targetId,
        abilityId: atk.abilityId,
        message: `${atk.sourceId} missed ${atk.targetId} with ${atk.abilityId}`,
      });
    } else {
      const target = result[atk.targetId];
      result[atk.targetId] = { ...target, currentHp: target.currentHp - atk.totalDamage };
      acc.actorDeltas.push({ actorId: atk.targetId, hpChange: -atk.totalDamage });
      acc.logs.push({
        tick,
        type: "damage",
        actorId: atk.sourceId,
        targetActorId: atk.targetId,
        abilityId: atk.abilityId,
        amount: atk.totalDamage,
        message: `${atk.sourceId} deals ${atk.totalDamage} damage to ${atk.targetId} with ${atk.abilityId}`,
      });

      if (atk.piercingDamage > 0) {
        result[atk.targetId] = updatePiercingDotBase(result[atk.targetId], atk.piercingDamage, context.effects);
      }
    }
  }

  // On-dodge reaction pass: each actor may trigger its on-dodge reaction at most once per tick
  const reactionUsedThisTick = new Set<ActorId>();
  for (const atk of attacks) {
    if (!atk.dodged) continue;
    const dodgerId = atk.targetId;
    if (reactionUsedThisTick.has(dodgerId)) continue;

    const rotation = context.rotations[dodgerId];
    const reactionAbilityId = rotation?.onDodgeReactionAbilityId;
    if (!reactionAbilityId) continue;

    // Internal cooldown check — reaction must not be on cooldown
    const dodger = result[dodgerId];
    if ((dodger.cooldowns[reactionAbilityId] ?? 0) > 0) continue;

    const reactionAbility = context.abilities[reactionAbilityId];
    if (!reactionAbility) continue;

    const reactionTargetId = getMainTarget(dodgerId, context.activity, result);
    if (!reactionTargetId) continue;
    const reactionTarget = result[reactionTargetId];
    if (!reactionTarget || reactionTarget.defeated) continue;

    acc.logs.push({
      tick,
      type: "action_selected",
      actorId: dodgerId,
      abilityId: reactionAbilityId,
      message: `${dodgerId} triggers ${reactionAbilityId} (on-dodge reaction)`,
    });

    // Roll reaction damage
    let reactionTotalDamage = 0;
    let reactionPiercingDamage = 0;
    for (const packet of reactionAbility.damagePackets ?? []) {
      if (reactionTarget.immunities?.[packet.damageType]) continue;
      const base = rng.rollInt(packet.interval.min, packet.interval.max);
      const mult = computeDamageMultiplier(
        dodger.activeEffects,
        reactionTarget.activeEffects,
        packet.damageType,
        context.effects
      );
      const afterMult = Math.round(base * mult);
      const resistance = reactionTarget.resistances?.[packet.damageType] ?? 0;
      const dmg = Math.max(0, afterMult - resistance);
      reactionTotalDamage += dmg;
      if (packet.damageType === "piercing" && dmg > 0) reactionPiercingDamage += dmg;
    }

    if (reactionTotalDamage > 0) {
      result[reactionTargetId] = {
        ...result[reactionTargetId],
        currentHp: result[reactionTargetId].currentHp - reactionTotalDamage,
      };
      acc.actorDeltas.push({ actorId: reactionTargetId, hpChange: -reactionTotalDamage });
      acc.logs.push({
        tick,
        type: "damage",
        actorId: dodgerId,
        targetActorId: reactionTargetId,
        abilityId: reactionAbilityId,
        amount: reactionTotalDamage,
        message: `${dodgerId} deals ${reactionTotalDamage} damage to ${reactionTargetId} with ${reactionAbilityId} (reaction)`,
      });

      if (reactionPiercingDamage > 0) {
        result[reactionTargetId] = updatePiercingDotBase(
          result[reactionTargetId],
          reactionPiercingDamage,
          context.effects
        );
      }
    }

    // Apply reaction ability effects
    const dotBase = reactionPiercingDamage > 0
      ? reactionPiercingDamage
      : (() => {
          const stored = result[reactionTargetId].activeEffects.find(
            (e) => e.effectId === "effect_bleeding"
          )?.metadata?.dotBaseAmount;
          return typeof stored === "number" ? stored : 0;
        })();

    for (const application of reactionAbility.appliesEffects ?? []) {
      const effectDef = context.effects[application.effectId];
      if (!effectDef) continue;

      const prob = application.chance ?? 1;
      if (prob < 1 && !rng.chance(prob)) continue;

      let effectTargetId: ActorId | null = null;
      if (application.target === "self") {
        effectTargetId = dodgerId;
      } else {
        effectTargetId = reactionTargetId;
      }
      if (!effectTargetId) continue;

      const effectBase = application.effectId === "effect_bleeding" ? dotBase : 0;
      result[effectTargetId] = applyEffectToActor(
        result[effectTargetId],
        effectTargetId,
        dodgerId,
        effectDef,
        application.stacks ?? 1,
        effectBase,
        acc,
        tick
      );
    }

    // Apply internal cooldown for the reaction ability
    if (reactionAbility.cooldownTicks) {
      result[dodgerId] = {
        ...result[dodgerId],
        cooldowns: {
          ...result[dodgerId].cooldowns,
          [reactionAbilityId]: reactionAbility.cooldownTicks,
        },
      };
    }

    reactionUsedThisTick.add(dodgerId);
  }

  // Third pass: apply ability effects from main selected actions
  for (const [actorId, abilityId] of Object.entries(selectedActions)) {
    const ability = context.abilities[abilityId];
    if (!ability?.appliesEffects?.length) continue;

    const mainTargetId = getMainTarget(actorId, context.activity, actors);

    for (const application of ability.appliesEffects) {
      const effectDef = context.effects[application.effectId];
      if (!effectDef) continue;

      // Skip proc check only when chance is explicitly < 1
      const prob = application.chance ?? 1;
      if (prob < 1 && !rng.chance(prob)) continue;

      let effectTargetId: ActorId | null = null;
      if (application.target === "self") {
        effectTargetId = actorId;
      } else if (
        application.target === "main_target" ||
        application.target === "enemy" ||
        application.target === "current_target"
      ) {
        effectTargetId = mainTargetId;
      }
      if (!effectTargetId) continue;

      const effectTarget = result[effectTargetId];
      if (!effectTarget) continue;

      // For percent_of_last_piercing_damage: use piercing damage dealt to the
      // effect target in this same tick, falling back to the stored value.
      const piercingToTarget = attacks
        .filter((a) => a.targetId === effectTargetId && a.piercingDamage > 0)
        .reduce((sum, a) => sum + a.piercingDamage, 0);
      const dotBase =
        piercingToTarget > 0
          ? piercingToTarget
          : (() => {
              const stored = effectTarget.activeEffects.find(
                (e) => e.effectId === effectDef.id
              )?.metadata?.dotBaseAmount;
              return typeof stored === "number" ? stored : 0;
            })();

      result[effectTargetId] = applyEffectToActor(
        result[effectTargetId],
        effectTargetId,
        actorId,
        effectDef,
        application.stacks ?? 1,
        dotBase,
        acc,
        tick
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 12 — Cooldown application
// ---------------------------------------------------------------------------

function applyCooldownsFromActions(
  actors: Record<ActorId, ActorCombatState>,
  selectedActions: Record<ActorId, AbilityId>,
  abilities: Record<string, AbilityDefinition>
): Record<ActorId, ActorCombatState> {
  const result = { ...actors };
  for (const [actorId, abilityId] of Object.entries(selectedActions)) {
    const ability = abilities[abilityId];
    if (!ability?.cooldownTicks) continue;
    const actor = result[actorId];
    result[actorId] = {
      ...actor,
      cooldowns: { ...actor.cooldowns, [abilityId]: ability.cooldownTicks },
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// State builder
// ---------------------------------------------------------------------------

function buildNextState(
  state: CombatRunState,
  actors: Record<ActorId, ActorCombatState>,
  acc: TickAccumulator,
  phase: CombatPhase,
  outcome: CombatOutcome | undefined,
  nextTick: number
): CombatRunState {
  return {
    ...state,
    currentTick: nextTick,
    phase,
    outcome,
    actors,
    logs: [...state.logs, ...acc.logs],
    accumulatedDelta: {
      ...state.accumulatedDelta,
      actorChanges: [...state.accumulatedDelta.actorChanges, ...acc.actorDeltas],
      effectsApplied: [
        ...state.accumulatedDelta.effectsApplied,
        ...acc.effectsApplied,
      ],
      effectsExpired: [
        ...state.accumulatedDelta.effectsExpired,
        ...acc.effectsExpired,
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Advances the combat state by one tick following the MVP tick order:
 *
 * 1. (Guard) Return immediately if phase is already "ended".
 * 2. Cooldowns tick down for all actors.
 * 3. Resource regeneration (MVP no-op).
 * 4. DOT resolution — each active start-of-tick DOT deals damage.
 * 5. Death check from DOTs — actors at ≤0 HP are marked defeated.
 *    Combat ends here if an actor dies from a DOT (enemy does not act).
 * 6. Action selection — each living actor picks an ability via its rotation.
 *    Skipped during prep phase; prep ticks only do steps 2–5.
 * 7. Simultaneous action resolution — damage packets from all actors are
 *    rolled from the pre-action state so mutual kills are possible.
 * 8. Defensive resolution — dodge check per attack (negates damage, +1 range for dodger;
 *    triggers on-dodge reactions such as Instant Pierce for Short Blade).
 * 9. Damage calculation — modifiers from active effects are applied.
 * 10. Effect application — ability after-effects are applied.
 * 11. Resource generation (MVP no-op).
 * 12. Cooldown application — spent abilities enter cooldown.
 * 13. Post-action death check.
 * 14. Log emission.
 * 15. Delta collection.
 *
 * @param state   The current combat state (immutable).
 * @param context Ability/effect definitions and per-actor rotations.
 * @param rng     The random number generator (swap {@link TestCombatRng} for
 *                deterministic tests).
 * @returns A new {@link CombatRunState} representing the state after the tick.
 */
export function runTick(
  state: CombatRunState,
  context: CombatTickContext,
  rng: CombatRng
): CombatRunState {
  if (state.phase === "ended") return state;

  const tick = state.currentTick;
  const acc = newAccumulator();

  // Step 2 — cooldowns
  let actors = tickAllCooldowns(state.actors);

  // Step 3 — resource regeneration (MVP no-op)

  // Steps 4+5 — DOT resolution + death check
  actors = resolveDotsAndTickEffects(actors, tick, context.effects, acc);
  actors = markDefeated(actors, tick, acc);

  const dotEnd = checkCombatEnd(actors, context.activity);
  if (dotEnd !== null) {
    acc.logs.push({
      tick,
      type: "outcome",
      message: `Combat ended: ${dotEnd.outcome}`,
    });
    return buildNextState(state, actors, acc, dotEnd.phase, dotEnd.outcome, tick + 1);
  }

  // Prep phase: skip action selection
  if (state.phase === "prep") {
    acc.logs.push({
      tick,
      type: "prep",
      message: `Prep tick ${tick + 1} of ${context.activity.prepTicks}`,
    });
    const nextPhase: CombatPhase =
      tick + 1 >= context.activity.prepTicks ? "combat" : "prep";
    return buildNextState(state, actors, acc, nextPhase, undefined, tick + 1);
  }

  // Step 6 — action selection
  const selectedActions = selectActionsForAll(actors, context);
  for (const [actorId, abilityId] of Object.entries(selectedActions)) {
    acc.logs.push({
      tick,
      type: "action_selected",
      actorId,
      abilityId,
      message: `${actorId} selects ${abilityId}`,
    });
  }

  // Steps 7–10 — simultaneous action resolution (damage + effects)
  actors = resolveActions(actors, selectedActions, context, rng, tick, acc);

  // Step 11 — resource generation (MVP no-op)

  // Step 12 — cooldown application
  actors = applyCooldownsFromActions(actors, selectedActions, context.abilities);

  // Step 13 — post-action death check
  actors = markDefeated(actors, tick, acc);

  // Steps 14+15 — check combat end, emit outcome log, collect delta
  const actionEnd = checkCombatEnd(actors, context.activity);
  const phase: CombatPhase = actionEnd ? "ended" : "combat";
  const outcome = actionEnd?.outcome;

  if (actionEnd) {
    acc.logs.push({
      tick,
      type: "outcome",
      message: `Combat ended: ${outcome}`,
    });
  }

  return buildNextState(state, actors, acc, phase, outcome, tick + 1);
}
