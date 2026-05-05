import type {
  ActorDefinition,
  EnemyDefinition,
  CombatActivityDefinition,
  CombatRunState,
  ActorCombatState,
} from "@rinner/grayvale-core";

function buildActorState(def: ActorDefinition): ActorCombatState {
  const resources: Record<string, number> = {};
  for (const r of def.resources ?? []) {
    resources[r.id] = r.startsAt ?? r.max ?? 0;
  }

  return {
    actorId: def.id,
    definitionId: def.id,
    currentHp: def.maxHp,
    maxHp: def.maxHp,
    level: def.level,
    tags: [...def.tags],
    resources,
    activeEffects: [],
    cooldowns: {},
    range: 0,
    defeated: false,
    resistances: def.resistances,
    immunities: def.immunities,
  };
}

/**
 * Creates the initial {@link CombatRunState} for a combat encounter.
 *
 * Actor states are seeded from the supplied definitions. The phase is set to
 * "prep" when the activity declares prep ticks, otherwise "combat".
 *
 * @param activity   The activity definition that configures this encounter.
 * @param playerDef  The player actor definition.
 * @param enemyDefs  Definitions for every enemy in the encounter, in the same
 *                   order as {@link CombatActivityDefinition.enemyActorIds}.
 */
export function createInitialCombatState(
  activity: CombatActivityDefinition,
  playerDef: ActorDefinition,
  enemyDefs: EnemyDefinition[]
): CombatRunState {
  const actors: Record<string, ActorCombatState> = {};

  actors[playerDef.id] = buildActorState(playerDef);
  for (const enemyDef of enemyDefs) {
    actors[enemyDef.id] = buildActorState(enemyDef);
  }

  const phase = activity.prepTicks > 0 ? "prep" : "combat";

  return {
    activityId: activity.id,
    currentTick: 0,
    phase,
    actors,
    logs: [],
    accumulatedDelta: {
      actorChanges: [],
      resourceChanges: [],
      effectsApplied: [],
      effectsExpired: [],
      xp: [],
      loot: [],
      penalties: [],
    },
  };
}
