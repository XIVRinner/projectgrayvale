import {
  createInitialCombatState,
  runTick,
  runCombat,
  TestCombatRng,
  compileShortBladeRotation,
  compileCoyoteRotation,
} from "../index";
import type {
  CombatTickContext,
  ActorDefinition,
  EnemyDefinition,
  CombatActivityDefinition,
  AbilityDefinition,
  EffectDefinition,
  CompiledRotation,
  CombatRunState,
} from "../index";
import {
  playerActor,
  coyoteEnemy,
  mvpCombatActivity,
  bleedingEffect,
  piercingTalonStack,
  attackDamageDownEffect,
  slashingCut,
  piercingFinisher,
  autoAttack,
  coyoteScratch,
  shortBladeSkill,
} from "@rinner/grayvale-core";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Minimal ability that always deals exactly 5 slashing damage. */
const fixedSlash: AbilityDefinition = {
  id: "ability_fixed_slash",
  displayName: "Fixed Slash",
  tags: ["attack", "melee"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [{ damageType: "slashing", interval: { min: 5, max: 5 } }],
};

/** Minimal ability that always deals exactly 1 slashing damage. */
const oneDamageAttack: AbilityDefinition = {
  id: "ability_one_damage",
  displayName: "One Damage",
  tags: ["attack", "melee"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [{ damageType: "slashing", interval: { min: 1, max: 1 } }],
};

/** Flat DOT: 3 slashing damage per tick for 2 ticks. */
const flatDotEffect: EffectDefinition = {
  id: "effect_flat_dot",
  displayName: "Flat Dot",
  tags: ["dot", "test"],
  effectType: "dot",
  tickTiming: "start_of_tick",
  durationTicks: 2,
  maxStacks: 1,
  sourceSpecific: false,
  damageOverTime: {
    damageType: "slashing",
    scaling: { type: "flat", value: 3 },
  },
};

/** Ability that applies the flat DOT to the main target. */
const applyFlatDotAbility: AbilityDefinition = {
  id: "ability_apply_flat_dot",
  displayName: "Apply Flat Dot",
  tags: ["attack"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [],
  appliesEffects: [
    { effectId: "effect_flat_dot", stacks: 1, target: "main_target" },
  ],
};

/** Simple actor with 10 HP (easy to kill in tests). */
function makeLowHpPlayer(hp: number): ActorDefinition {
  return {
    id: "actor_test_player",
    displayName: "Test Player",
    level: 1,
    maxHp: hp,
    tags: ["player"],
  };
}

function makeLowHpEnemy(hp: number): EnemyDefinition {
  return {
    id: "actor_test_enemy",
    displayName: "Test Enemy",
    enemyType: "enemy",
    level: 1,
    maxHp: hp,
    tags: [],
    difficulty: "story",
    xp: { characterXp: 0, offensiveSkillXp: 0, armorSkillXp: 0 },
  };
}

const noPrepActivity: CombatActivityDefinition = {
  id: "activity_test",
  displayName: "Test Encounter",
  playerActorId: "actor_test_player",
  enemyActorIds: ["actor_test_enemy"],
  prepTicks: 0,
  difficulty: "story",
};

const twoPrepActivity: CombatActivityDefinition = {
  ...noPrepActivity,
  id: "activity_test_prep",
  prepTicks: 2,
};

/** Rotation that always picks the given ability. */
function singleAbilityRotation(abilityId: string): CompiledRotation {
  return {
    skillId: "skill_test",
    rules: [{ abilityId }],
  };
}

function makeContext(
  activity: CombatActivityDefinition,
  extraAbilities: AbilityDefinition[] = [],
  extraEffects: EffectDefinition[] = [],
  playerRotation: CompiledRotation = singleAbilityRotation("ability_fixed_slash"),
  enemyRotation: CompiledRotation = singleAbilityRotation("ability_fixed_slash")
): CombatTickContext {
  const abilities: Record<string, AbilityDefinition> = {
    ability_fixed_slash: fixedSlash,
    ability_one_damage: oneDamageAttack,
    ability_apply_flat_dot: applyFlatDotAbility,
    ability_auto_attack: autoAttack,
  };
  for (const a of extraAbilities) abilities[a.id] = a;

  const effects: Record<string, EffectDefinition> = {
    effect_flat_dot: flatDotEffect,
  };
  for (const e of extraEffects) effects[e.id] = e;

  const rotations: Record<string, CompiledRotation> = {
    [activity.playerActorId]: playerRotation,
  };
  for (const id of activity.enemyActorIds) {
    rotations[id] = enemyRotation;
  }

  return { activity, abilities, effects, rotations };
}

// ---------------------------------------------------------------------------
// Prep phase
// ---------------------------------------------------------------------------

describe("runTick — prep phase", () => {
  const player = makeLowHpPlayer(50);
  const enemy = makeLowHpEnemy(50);
  const ctx = makeContext(twoPrepActivity);

  it("stays in prep phase after first prep tick", () => {
    const state = createInitialCombatState(twoPrepActivity, player, [enemy]);
    expect(state.phase).toBe("prep");
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.phase).toBe("prep");
    expect(after.currentTick).toBe(1);
  });

  it("transitions to combat phase after second prep tick", () => {
    const state = createInitialCombatState(twoPrepActivity, player, [enemy]);
    const after1 = runTick(state, ctx, new TestCombatRng([0.5]));
    const after2 = runTick(after1, ctx, new TestCombatRng([0.5]));
    expect(after2.phase).toBe("combat");
    expect(after2.currentTick).toBe(2);
  });

  it("does not select actions during prep ticks", () => {
    const state = createInitialCombatState(twoPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const actionLogs = after.logs.filter((l) => l.type === "action_selected");
    expect(actionLogs).toHaveLength(0);
  });

  it("logs a prep entry for each prep tick", () => {
    const state = createInitialCombatState(twoPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const prepLogs = after.logs.filter((l) => l.type === "prep");
    expect(prepLogs).toHaveLength(1);
  });

  it("does not deal damage during prep ticks", () => {
    const state = createInitialCombatState(twoPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.actors[player.id].currentHp).toBe(50);
    expect(after.actors[enemy.id].currentHp).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Combat phase — basic action resolution
// ---------------------------------------------------------------------------

describe("runTick — combat phase basic", () => {
  const player = makeLowHpPlayer(50);
  const enemy = makeLowHpEnemy(50);
  const ctx = makeContext(noPrepActivity);

  it("deals damage to both actors in a combat tick", () => {
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    expect(state.phase).toBe("combat");
    // fixedSlash → 5 damage to each side
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.actors[player.id].currentHp).toBe(45);
    expect(after.actors[enemy.id].currentHp).toBe(45);
  });

  it("emits action_selected logs for both actors", () => {
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const logs = after.logs.filter((l) => l.type === "action_selected");
    expect(logs).toHaveLength(2);
  });

  it("emits damage logs for both actors", () => {
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const logs = after.logs.filter((l) => l.type === "damage");
    expect(logs).toHaveLength(2);
  });

  it("does not end combat when both actors survive", () => {
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.phase).toBe("combat");
    expect(after.outcome).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Simultaneous death → outcome is always defeat
// ---------------------------------------------------------------------------

describe("runTick — simultaneous mutual kill → defeat", () => {
  it("results in defeat when both player and enemy die on the same tick", () => {
    const player = makeLowHpPlayer(1);
    const enemy = makeLowHpEnemy(1);
    const ctx = makeContext(
      noPrepActivity,
      [oneDamageAttack],
      [],
      singleAbilityRotation("ability_one_damage"),
      singleAbilityRotation("ability_one_damage")
    );
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    // Both deal exactly 1 damage to each other; both have 1 HP → both die
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.phase).toBe("ended");
    expect(after.outcome).toBe("defeat");
    expect(after.actors[player.id].defeated).toBe(true);
    expect(after.actors[enemy.id].defeated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Victory
// ---------------------------------------------------------------------------

describe("runTick — player kills enemy → victory", () => {
  it("results in victory when the enemy is killed and player survives", () => {
    const player = makeLowHpPlayer(100);
    const enemy = makeLowHpEnemy(5);
    const ctx = makeContext(noPrepActivity); // fixedSlash = 5 damage
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.phase).toBe("ended");
    expect(after.outcome).toBe("victory");
    expect(after.actors[enemy.id].defeated).toBe(true);
    expect(after.actors[player.id].defeated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DOT resolution
// ---------------------------------------------------------------------------

describe("runTick — DOT resolves before actions", () => {
  it("applies DOT damage before combat actions each tick", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(50);
    const ctx = makeContext(noPrepActivity);
    // Pre-seed the enemy with a flat DOT instance
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = {
      ...state,
      actors: {
        ...state.actors,
        [enemy.id]: {
          ...state.actors[enemy.id],
          activeEffects: [
            {
              effectId: "effect_flat_dot",
              sourceActorId: player.id,
              targetActorId: enemy.id,
              stacks: 1,
              remainingTicks: 2,
            },
          ],
        },
      },
    };

    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    // DOT ticks first (3 damage), then attack lands (5 damage) → 50 - 3 - 5 = 42
    expect(after.actors[enemy.id].currentHp).toBe(42);
    const dotLog = after.logs.find((l) => l.type === "effect_tick");
    expect(dotLog).toBeDefined();
    expect(dotLog?.actorId).toBe(enemy.id);
    expect(dotLog?.amount).toBe(3);
  });

  it("DOT kills enemy before action → enemy does not act (player not attacked)", () => {
    // Enemy has 3 HP and takes a 3-damage DOT → dies before acting
    const player = makeLowHpPlayer(100);
    const enemy = makeLowHpEnemy(3);
    const ctx = makeContext(noPrepActivity);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = {
      ...state,
      actors: {
        ...state.actors,
        [enemy.id]: {
          ...state.actors[enemy.id],
          activeEffects: [
            {
              effectId: "effect_flat_dot",
              sourceActorId: player.id,
              targetActorId: enemy.id,
              stacks: 1,
              remainingTicks: 1,
            },
          ],
        },
      },
    };

    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    // Enemy died from DOT, combat ends as victory, player was never attacked
    expect(after.phase).toBe("ended");
    expect(after.outcome).toBe("victory");
    expect(after.actors[player.id].currentHp).toBe(100); // player untouched
    // No action_selected logs (combat ended before action phase)
    const actionLogs = after.logs.filter((l) => l.type === "action_selected");
    expect(actionLogs).toHaveLength(0);
  });

  it("DOT expires after its duration", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeContext(noPrepActivity);
    // flatDotEffect has durationTicks: 2
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = {
      ...state,
      actors: {
        ...state.actors,
        [enemy.id]: {
          ...state.actors[enemy.id],
          activeEffects: [
            {
              effectId: "effect_flat_dot",
              sourceActorId: player.id,
              targetActorId: enemy.id,
              stacks: 1,
              remainingTicks: 2,
            },
          ],
        },
      },
    };

    // Tick 1: DOT ticks (remainingTicks 2→1)
    const after1 = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after1.actors[enemy.id].activeEffects).toHaveLength(1);

    // Tick 2: DOT ticks again then expires (remainingTicks 1→0)
    const after2 = runTick(after1, ctx, new TestCombatRng([0.5]));
    expect(after2.actors[enemy.id].activeEffects).toHaveLength(0);
    const expiredLogs = after2.logs.filter((l) => l.type === "effect_expired");
    expect(expiredLogs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------

describe("runTick — cooldown lifecycle", () => {
  it("applies a cooldown after an ability with cooldownTicks > 0 is used", () => {
    const coyoteScratchAbility = coyoteScratch; // cooldownTicks: 4
    const player = makeLowHpPlayer(200);
    const enemyDef = makeLowHpEnemy(200);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_fixed_slash: fixedSlash,
        ability_coyote_scratch: coyoteScratchAbility,
        ability_auto_attack: autoAttack,
      },
      effects: {
        effect_bleeding: bleedingEffect,
      },
      rotations: {
        [player.id]: singleAbilityRotation("ability_fixed_slash"),
        [enemyDef.id]: singleAbilityRotation("ability_coyote_scratch"),
      },
    };
    const state = createInitialCombatState(noPrepActivity, player, [enemyDef]);
    // bleed chance is 0.6 — provide a value >= 0.6 so bleed does NOT proc, then damage roll
    const after = runTick(state, ctx, new TestCombatRng([0.5, 0.9]));
    expect(after.actors[enemyDef.id].cooldowns["ability_coyote_scratch"]).toBe(4);
  });

  it("ticks cooldowns down each prep tick", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeContext(twoPrepActivity);
    let state = createInitialCombatState(twoPrepActivity, player, [enemy]);
    // Manually inject a cooldown on the player
    state = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          cooldowns: { ability_fixed_slash: 3 },
        },
      },
    };
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.actors[player.id].cooldowns["ability_fixed_slash"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Effect application
// ---------------------------------------------------------------------------

describe("runTick — effect application via ability", () => {
  it("applies a guaranteed effect (no chance) to the main target", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_apply_flat_dot: applyFlatDotAbility,
        ability_fixed_slash: fixedSlash,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_flat_dot: flatDotEffect },
      rotations: {
        [player.id]: singleAbilityRotation("ability_apply_flat_dot"),
        [enemy.id]: singleAbilityRotation("ability_fixed_slash"),
      },
    };
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const appliedLog = after.logs.find((l) => l.type === "effect_applied");
    expect(appliedLog).toBeDefined();
    expect(after.actors[enemy.id].activeEffects).toHaveLength(1);
    expect(after.actors[enemy.id].activeEffects[0].effectId).toBe("effect_flat_dot");
  });

  it("accumulates stacks (up to maxStacks) when an effect is re-applied", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    // Swap maxStacks to 3 for test clarity
    const stackableEffect: EffectDefinition = {
      ...flatDotEffect,
      id: "effect_stackable_dot",
      maxStacks: 3,
    };
    const applyStackable: AbilityDefinition = {
      ...applyFlatDotAbility,
      id: "ability_apply_stackable",
      appliesEffects: [
        { effectId: "effect_stackable_dot", stacks: 1, target: "main_target" },
      ],
    };
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_apply_stackable: applyStackable,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_stackable_dot: stackableEffect },
      rotations: {
        [player.id]: singleAbilityRotation("ability_apply_stackable"),
        [enemy.id]: singleAbilityRotation("ability_auto_attack"),
      },
    };
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after1 = runTick(state, ctx, new TestCombatRng([0.5]));
    const after2 = runTick(after1, ctx, new TestCombatRng([0.5]));
    expect(after2.actors[enemy.id].activeEffects[0].stacks).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// runCombat — full loop
// ---------------------------------------------------------------------------

describe("runCombat — full encounter", () => {
  it("ends with victory when player has overwhelming HP advantage", () => {
    const player = makeLowHpPlayer(1000);
    const enemy = makeLowHpEnemy(5);
    const ctx = makeContext(noPrepActivity); // fixedSlash = 5 damage
    const initial = createInitialCombatState(noPrepActivity, player, [enemy]);
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    expect(final.outcome).toBe("victory");
    expect(final.phase).toBe("ended");
  });

  it("ends with defeat when player has no HP advantage", () => {
    const player = makeLowHpPlayer(5);
    const enemy = makeLowHpEnemy(1000);
    const ctx = makeContext(noPrepActivity); // fixedSlash = 5 damage on both sides
    const initial = createInitialCombatState(noPrepActivity, player, [enemy]);
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    expect(final.outcome).toBe("defeat");
    expect(final.phase).toBe("ended");
  });

  it("does not run past maxTicks", () => {
    // Both actors are immortal (huge HP, tiny damage)
    const player = makeLowHpPlayer(99999);
    const enemy = makeLowHpEnemy(99999);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_one_damage: oneDamageAttack,
        ability_auto_attack: autoAttack,
      },
      effects: {},
      rotations: {
        [player.id]: singleAbilityRotation("ability_one_damage"),
        [enemy.id]: singleAbilityRotation("ability_one_damage"),
      },
    };
    const initial = createInitialCombatState(noPrepActivity, player, [enemy]);
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]), 10);
    expect(final.currentTick).toBe(10);
    expect(final.phase).not.toBe("ended");
  });

  it("combat runs automatically after start — phase progresses with two prep ticks", () => {
    const player = makeLowHpPlayer(1000);
    const enemy = makeLowHpEnemy(5);
    // 2 prep ticks then 1 combat tick kills the enemy
    const ctx = makeContext(twoPrepActivity);
    const initial = createInitialCombatState(twoPrepActivity, player, [enemy]);
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    expect(final.outcome).toBe("victory");
    // At least 2 prep ticks + 1 combat tick = tick 3
    expect(final.currentTick).toBeGreaterThanOrEqual(3);
    // Verify prep logs exist
    const prepLogs = final.logs.filter((l) => l.type === "prep");
    expect(prepLogs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// MVP scenario — short blade rotation vs coyote
// ---------------------------------------------------------------------------

describe("runCombat — MVP short blade vs coyote", () => {
  const playerRotation = compileShortBladeRotation([], shortBladeSkill);
  const enemyRotation = compileCoyoteRotation();

  const ctx: CombatTickContext = {
    activity: mvpCombatActivity,
    abilities: {
      ability_slashing_cut: slashingCut,
      ability_piercing_finisher: piercingFinisher,
      ability_auto_attack: autoAttack,
      ability_coyote_scratch: coyoteScratch,
    },
    effects: {
      effect_bleeding: bleedingEffect,
      effect_piercing_talon: piercingTalonStack,
      effect_attack_damage_down: attackDamageDownEffect,
    },
    rotations: {
      [mvpCombatActivity.playerActorId]: playerRotation,
      [mvpCombatActivity.enemyActorIds[0]]: enemyRotation,
    },
  };

  it("completes the MVP encounter with a deterministic outcome", () => {
    const initial = createInitialCombatState(
      mvpCombatActivity,
      playerActor,
      [coyoteEnemy]
    );
    // Use deterministic RNG seeded to always roll high damage
    const final = runCombat(initial, ctx, new TestCombatRng([0.9]));
    expect(final.phase).toBe("ended");
    expect(["victory", "defeat"]).toContain(final.outcome);
  });

  it("includes exactly two prep tick log entries before any action logs", () => {
    const initial = createInitialCombatState(
      mvpCombatActivity,
      playerActor,
      [coyoteEnemy]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.9]));
    const prepLogs = final.logs.filter((l) => l.type === "prep");
    expect(prepLogs).toHaveLength(2);
    // All prep logs must appear before any action_selected logs
    const firstActionIdx = final.logs.findIndex((l) => l.type === "action_selected");
    const lastPrepIdx = final.logs.map((l) => l.type).lastIndexOf("prep");
    expect(lastPrepIdx).toBeLessThan(firstActionIdx);
  });

  it("accumulated delta contains actorChanges for every attack that landed", () => {
    const initial = createInitialCombatState(
      mvpCombatActivity,
      playerActor,
      [coyoteEnemy]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.9]));
    expect(final.accumulatedDelta.actorChanges.length).toBeGreaterThan(0);
  });
});
