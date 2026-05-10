import type {
  ActorDefinition,
  CombatActivityDefinition,
  CombatLogEntry,
  CombatRunState,
  CompiledRotation,
  EquipmentDefinition,
  EnemyDefinition,
  Player
} from "@rinner/grayvale-core";
import {
  attackDamageDownEffect,
  autoAttack,
  bleedingEffect,
  coyoteEnemy,
  coyoteScratch,
  instantPierce,
  mvpCombatActivity,
  oldDagger,
  piercingFinisher,
  piercingTalonStack,
  playerActor,
  shortBladeSkill,
  slashingCut,
  storyDifficultyProfile
} from "@rinner/grayvale-core";
import type { CombatTickContext } from "@rinner/grayvale-combat";
import {
  compileCoyoteRotation,
  compileShortBladeRotation
} from "@rinner/grayvale-combat";

import type { SaveSlotHealthState } from "../../core/services/health-balance";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import type {
  CombatActorCardView,
  CombatEncounterView,
  CombatLogLineView,
  CombatRewardLineView,
  CombatRotationRuleView
} from "./combat.types";

// GAP: General combat encounter registry
// Blocked on: @rinner/grayvale-core | design
// Needs: authored encounter definitions that map game activities, game item ids,
// skill ids, and persistent combat consequences into the combat engine.
// Do not implement until: a shared combat encounter registry and player/loadout
// bridge are defined across the core and game packages.
//
// Current scope: an explicit adapter for the tutorial coyote encounter so the
// in-game presentation matches the existing combat engine/tests without inventing
// a fake generic registry.

const TUTORIAL_ACTIVITY_ID = "coyote_culling";
const HUNT_COYOTE_ACTIVITY_ID = "hunt_coyote";
const GAME_TO_COMBAT_SKILL_ID = {
  skill_short_blade: "short_blade"
} as const satisfies Record<string, string>;
const GAME_TO_COMBAT_WEAPON_ID = {
  weapon_dagger_rustleaf: oldDagger.id,
  weapon_dagger_coyote_fang: "item_coyote_fang_dagger"
} as const satisfies Record<string, string>;

const huntCoyoteEnemy: EnemyDefinition = {
  ...coyoteEnemy,
  id: "actor_coyote_hunt",
  displayName: "Hunting Coyote",
  level: 3,
  maxHp: 58,
  xp: {
    characterXp: 16,
    offensiveSkillXp: 6,
    armorSkillXp: 4
  }
};

const coyoteFangDagger: EquipmentDefinition = {
  ...oldDagger,
  id: "item_coyote_fang_dagger",
  displayName: "Coyote Fang Dagger",
  itemLevel: 3,
  damage: {
    piercing: { min: 5, max: 11 },
    slashing: { min: 3, max: 7 }
  },
  modifiers: [
    {
      id: "mod_coyote_fang_strength",
      target: "strength",
      operation: "add",
      value: 2
    }
  ],
  tags: [...oldDagger.tags, "beast"]
};

export interface CombatEncounterBundle {
  readonly activity: CombatActivityDefinition;
  readonly player: ActorDefinition;
  readonly enemies: readonly EnemyDefinition[];
  readonly context: CombatTickContext;
  readonly rotationPreview: readonly CombatRotationRuleView[];
}

export function isSupportedCombatActivity(activity: GameActivityDefinition): boolean {
  return (
    (activity.id === TUTORIAL_ACTIVITY_ID && activity.questSignal?.type === "kill") ||
    activity.id === HUNT_COYOTE_ACTIVITY_ID
  );
}

export function buildCombatEncounterBundle(
  activity: GameActivityDefinition,
  player: Player,
  health: SaveSlotHealthState | null
): CombatEncounterBundle | null {
  if (!isSupportedCombatActivity(activity)) {
    return null;
  }

  const enemy = resolveEncounterEnemy(activity.id);
  const adaptedPlayer = buildTutorialPlayerActor(player, health);
  const playerRotation = compileShortBladeRotation([oldDagger, coyoteFangDagger], shortBladeSkill);
  const enemyRotation = compileCoyoteRotation();
  const adaptedActivity: CombatActivityDefinition = {
    ...mvpCombatActivity,
    id: activity.id,
    displayName: activity.name,
    playerActorId: adaptedPlayer.id,
    enemyActorIds: [enemy.id]
  };

  const context: CombatTickContext = {
    activity: adaptedActivity,
    abilities: {
      ability_auto_attack: autoAttack,
      ability_coyote_scratch: coyoteScratch,
      ability_instant_pierce: instantPierce,
      ability_piercing_finisher: piercingFinisher,
      ability_slashing_cut: slashingCut
    },
    effects: {
      effect_attack_damage_down: attackDamageDownEffect,
      effect_bleeding: bleedingEffect,
      effect_piercing_talon: piercingTalonStack
    },
    rotations: {
      [adaptedPlayer.id]: playerRotation,
      [enemy.id]: enemyRotation
    },
    enemyXp: {
      [enemy.id]: enemy.xp
    },
    difficultyProfiles: {
      [storyDifficultyProfile.id]: storyDifficultyProfile
    },
    equipment: {
      [oldDagger.id]: oldDagger,
      [coyoteFangDagger.id]: coyoteFangDagger
    },
    playerEquipment: adaptedPlayer.equipment
  };

  return {
    activity: adaptedActivity,
    player: adaptedPlayer,
    enemies: [enemy],
    context,
    rotationPreview: buildRotationPreview(playerRotation, context)
  };
}

export function buildCombatEncounterView(
  bundle: CombatEncounterBundle,
  state: CombatRunState,
  rewards: readonly CombatRewardLineView[],
  summary: string
): CombatEncounterView {
  const player = buildActorCardView(
    bundle.player.id,
    bundle.player.displayName,
    "player",
    state
  );
  const enemies = bundle.enemies.map((enemy) =>
    buildActorCardView(enemy.id, enemy.displayName, "enemy", state)
  );

  return {
    activityId: bundle.activity.id,
    title: bundle.activity.displayName,
    phaseLabel: toPhaseLabel(state.phase),
    tickLabel: `Tick ${state.currentTick}`,
    summary,
    outcomeLabel: state.outcome ? toOutcomeLabel(state.outcome) : null,
    player,
    enemies,
    logs: buildLogLines(state.logs),
    rotation: bundle.rotationPreview,
    rewards
  };
}

export function getCombatRoutePreview(
  player: Player | null,
  health: SaveSlotHealthState | null
): readonly CombatRotationRuleView[] {
  if (!player) {
    return [];
  }

  const activity: GameActivityDefinition = {
    id: TUTORIAL_ACTIVITY_ID,
    name: "Cull the Coyote",
    description: "",
    location: {
      locationId: "forest_edge"
    },
    tags: ["forest", "quest"],
    governingAttributes: ["agility", "vitality"],
    difficulty: 6,
    questSignal: {
      type: "kill",
      target: "arkama_coyote",
      count: 1
    }
  };

  return buildCombatEncounterBundle(activity, player, health)?.rotationPreview ?? [];
}

function resolveEncounterEnemy(activityId: string): EnemyDefinition {
  if (activityId === HUNT_COYOTE_ACTIVITY_ID) {
    return huntCoyoteEnemy;
  }

  return coyoteEnemy;
}

export function mapCombatSkillIdToPlayerSkillId(skillId: string): string | null {
  return GAME_TO_COMBAT_SKILL_ID[skillId as keyof typeof GAME_TO_COMBAT_SKILL_ID] ?? null;
}

function buildTutorialPlayerActor(
  player: Player,
  health: SaveSlotHealthState | null
): ActorDefinition {
  const equippedWeaponId =
    player.equippedItems.mainHand &&
    GAME_TO_COMBAT_WEAPON_ID[player.equippedItems.mainHand as keyof typeof GAME_TO_COMBAT_WEAPON_ID]
      ? GAME_TO_COMBAT_WEAPON_ID[
          player.equippedItems.mainHand as keyof typeof GAME_TO_COMBAT_WEAPON_ID
        ]
      : oldDagger.id;

  return {
    ...playerActor,
    id: player.id,
    displayName: player.name,
    level: player.progression.level,
    maxHp: health?.maxHp ?? playerActor.maxHp,
    tags: ["player", player.raceId],
    equipment: {
      main_hand: equippedWeaponId
    }
  };
}

function buildRotationPreview(
  rotation: CompiledRotation,
  context: CombatTickContext
): readonly CombatRotationRuleView[] {
  const abilityById = context.abilities;
  const rows = rotation.rules.map((rule, index) => ({
    id: `${rule.abilityId}:${index}`,
    abilityLabel: abilityById[rule.abilityId]?.displayName ?? prettyLabel(rule.abilityId),
    detail: describeRule(rule.abilityId, rule.condition, rule.isFallback === true, abilityById),
    isFallback: rule.isFallback === true,
    isReaction: false
  }));

  if (rotation.onDodgeReactionAbilityId) {
    rows.push({
      id: `${rotation.onDodgeReactionAbilityId}:reaction`,
      abilityLabel:
        abilityById[rotation.onDodgeReactionAbilityId]?.displayName ??
        prettyLabel(rotation.onDodgeReactionAbilityId),
      detail: "Free reaction after a successful dodge.",
      isFallback: false,
      isReaction: true
    });
  }

  return rows;
}

function buildActorCardView(
  actorId: string,
  name: string,
  role: "player" | "enemy",
  state: CombatRunState
): CombatActorCardView {
  const actor = state.actors[actorId];
  const currentHp = Math.max(0, actor?.currentHp ?? 0);
  const maxHp = Math.max(1, actor?.maxHp ?? 1);

  return {
    id: actorId,
    name,
    role,
    currentHp,
    maxHp,
    hpPercent: Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100))),
    statusLabel: actor?.defeated ? "Defeated" : `${currentHp}/${maxHp} HP`,
    effectLabels: (actor?.activeEffects ?? []).map((effect) => formatEffectLabel(effect.effectId, effect.stacks))
  };
}

function buildLogLines(logs: readonly CombatLogEntry[]): readonly CombatLogLineView[] {
  return logs.slice(-18).map((log, index) => ({
    id: `${log.tick}:${log.type}:${index}`,
    tick: log.tick,
    text: log.message,
    type: log.type
  }));
}

function describeRule(
  abilityId: string,
  condition: CompiledRotation["rules"][number]["condition"] | undefined,
  isFallback: boolean,
  abilityById: CombatTickContext["abilities"]
): string {
  if (isFallback) {
    return "Fallback when no higher-priority rule is available.";
  }

  if (!condition) {
    return `${abilityById[abilityId]?.displayName ?? prettyLabel(abilityId)} is the default action.`;
  }

  switch (condition.type) {
    case "ability_not_on_cooldown":
      return "Use as soon as the cooldown clears.";
    case "effect_stacks_gte":
      return `Use once ${prettyLabel(condition.effectId)} reaches ${condition.threshold} stacks.`;
  }
}

function toPhaseLabel(phase: CombatRunState["phase"]): string {
  switch (phase) {
    case "prep":
      return "Prep";
    case "combat":
      return "Combat";
    case "ended":
      return "Ended";
  }
}

function toOutcomeLabel(outcome: NonNullable<CombatRunState["outcome"]>): string {
  switch (outcome) {
    case "victory":
      return "Victory";
    case "defeat":
      return "Defeat";
    case "fled":
      return "Fled";
  }
}

function prettyLabel(value: string): string {
  return value.replace(/^(ability_|effect_|item_|skill_)/, "").replace(/_/g, " ");
}

function formatEffectLabel(effectId: string, stacks: number): string {
  const baseLabel = prettyLabel(effectId).replace(/\b\w/g, (char) => char.toUpperCase());
  return stacks > 1 ? `${baseLabel} x${stacks}` : baseLabel;
}
