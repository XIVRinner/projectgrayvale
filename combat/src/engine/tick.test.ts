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
  instantPierce,
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

// ---------------------------------------------------------------------------
// Damage calculation — resistance, immunity, and miss
// ---------------------------------------------------------------------------

describe("runTick — flat resistance reduces damage", () => {
  it("reduces damage by the flat resistance value", () => {
    // fixedSlash deals exactly 5 slashing damage; slashing resistance = 3 → net 2
    const player = makeLowHpPlayer(50);
    const enemy: EnemyDefinition = {
      ...makeLowHpEnemy(50),
      resistances: { slashing: 3 },
    };
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    // Player takes fixedSlash (5) from enemy, no resistance → 50 - 5 = 45
    expect(after.actors[player.id].currentHp).toBe(45);
    // Enemy takes fixedSlash (5) reduced by 3 → net 2 → 50 - 2 = 48
    expect(after.actors[enemy.id].currentHp).toBe(48);
  });

  it("emits a damage log with the net (post-resistance) amount", () => {
    const player = makeLowHpPlayer(200);
    const enemy: EnemyDefinition = {
      ...makeLowHpEnemy(50),
      resistances: { slashing: 2 },
    };
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const dmgLog = after.logs.find(
      (l) => l.type === "damage" && l.targetActorId === enemy.id
    );
    expect(dmgLog).toBeDefined();
    expect(dmgLog?.amount).toBe(3); // 5 - 2
  });
});

describe("runTick — immunity produces a miss", () => {
  it("logs a miss when the target is immune to the damage type", () => {
    const player = makeLowHpPlayer(200);
    const enemy: EnemyDefinition = {
      ...makeLowHpEnemy(50),
      immunities: { slashing: true },
    };
    const ctx = makeContext(noPrepActivity); // fixedSlash is slashing
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const missLog = after.logs.find(
      (l) => l.type === "miss" && l.targetActorId === enemy.id
    );
    expect(missLog).toBeDefined();
    // Enemy HP must be unchanged
    expect(after.actors[enemy.id].currentHp).toBe(50);
  });

  it("does not emit a damage log when immunity blocks all packets", () => {
    const player = makeLowHpPlayer(200);
    const enemy: EnemyDefinition = {
      ...makeLowHpEnemy(50),
      immunities: { slashing: true },
    };
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const dmgLog = after.logs.find(
      (l) => l.type === "damage" && l.targetActorId === enemy.id
    );
    expect(dmgLog).toBeUndefined();
  });
});

describe("runTick — resistance drains damage to miss", () => {
  it("produces a miss when resistance equals or exceeds the rolled damage", () => {
    // fixedSlash rolls exactly 5; resistance = 5 → net 0 → miss
    const player = makeLowHpPlayer(200);
    const enemy: EnemyDefinition = {
      ...makeLowHpEnemy(50),
      resistances: { slashing: 5 },
    };
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const missLog = after.logs.find(
      (l) => l.type === "miss" && l.targetActorId === enemy.id
    );
    expect(missLog).toBeDefined();
    expect(after.actors[enemy.id].currentHp).toBe(50);
  });

  it("produces a miss when resistance exceeds the rolled damage", () => {
    // fixedSlash rolls exactly 5; resistance = 10 → net -5 → miss
    const player = makeLowHpPlayer(200);
    const enemy: EnemyDefinition = {
      ...makeLowHpEnemy(50),
      resistances: { slashing: 10 },
    };
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const missLog = after.logs.find(
      (l) => l.type === "miss" && l.targetActorId === enemy.id
    );
    expect(missLog).toBeDefined();
    expect(after.actors[enemy.id].currentHp).toBe(50);
  });
});

describe("runTick — damage rolls are integers", () => {
  it("damage amount logged is always an integer", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const dmgLogs = after.logs.filter((l) => l.type === "damage");
    for (const log of dmgLogs) {
      expect(log.amount).toBeDefined();
      expect(Number.isInteger(log.amount)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Dodge
// ---------------------------------------------------------------------------

describe("runTick — dodge negates incoming damage", () => {
  /** Player actor with 100% dodge chance for deterministic tests. */
  function makeFullDodgePlayer(hp: number): ActorDefinition {
    return { ...makeLowHpPlayer(hp), id: "actor_test_player" };
  }

  function withDodgeChance(
    state: CombatRunState,
    actorId: string,
    chance: number
  ): CombatRunState {
    return {
      ...state,
      actors: {
        ...state.actors,
        [actorId]: { ...state.actors[actorId], dodgeChance: chance },
      },
    };
  }

  it("player takes no damage when dodge chance is 1 (RNG below threshold)", () => {
    const player = makeFullDodgePlayer(50);
    const enemy = makeLowHpEnemy(50);
    const ctx = makeContext(noPrepActivity);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    // Set player dodge to 1 so the first rng.chance call (0.0 < 1.0) is true
    state = withDodgeChance(state, player.id, 1);
    // RNG value 0.0 → dodge check succeeds; enemy still attacks (fixed slash = 5)
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5]));
    expect(after.actors[player.id].currentHp).toBe(50); // no damage to player
    expect(after.actors[enemy.id].currentHp).toBe(45);  // enemy still takes damage
  });

  it("emits a dodge log when a dodge occurs", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(50);
    const ctx = makeContext(noPrepActivity);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5]));
    const dodgeLogs = after.logs.filter((l) => l.type === "dodge");
    expect(dodgeLogs).toHaveLength(1);
    expect(dodgeLogs[0].actorId).toBe(player.id);
  });

  it("dodge adds +1 range to the dodging actor", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(50);
    const ctx = makeContext(noPrepActivity);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5]));
    expect(after.actors[player.id].range).toBe(1);
  });

  it("no dodge log when dodge chance is 0", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(50);
    const ctx = makeContext(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    // dodgeChance defaults to undefined → no dodge
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    const dodgeLogs = after.logs.filter((l) => l.type === "dodge");
    expect(dodgeLogs).toHaveLength(0);
    // player takes damage normally
    expect(after.actors[player.id].currentHp).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// On-dodge Instant Pierce reaction (Short Blade)
// ---------------------------------------------------------------------------

describe("runTick — on-dodge Instant Pierce reaction", () => {
  /** Build a context with instant pierce available and player dodge chance = 1. */
  function makeInstantPierceCtx(
    activity: CombatActivityDefinition,
    playerRotation: CompiledRotation,
    enemyRotation: CompiledRotation = singleAbilityRotation("ability_fixed_slash")
  ): CombatTickContext {
    return {
      activity,
      abilities: {
        ability_fixed_slash: fixedSlash,
        ability_instant_pierce: instantPierce,
        ability_auto_attack: autoAttack,
      },
      effects: {
        effect_bleeding: bleedingEffect,
        effect_attack_damage_down: attackDamageDownEffect,
      },
      rotations: {
        [activity.playerActorId]: playerRotation,
        [activity.enemyActorIds[0]]: enemyRotation,
      },
    };
  }

  const pierceRotation: CompiledRotation = {
    skillId: "skill_short_blade",
    onDodgeReactionAbilityId: "ability_instant_pierce",
    rules: [{ abilityId: "ability_fixed_slash" }],
  };

  function withDodgeChance(
    state: CombatRunState,
    actorId: string,
    chance: number
  ): CombatRunState {
    return {
      ...state,
      actors: {
        ...state.actors,
        [actorId]: { ...state.actors[actorId], dodgeChance: chance },
      },
    };
  }

  it("Instant Pierce fires and deals damage when player dodges", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeInstantPierceCtx(noPrepActivity, pierceRotation);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    // RNG: [0.0 → dodge check passes], [rollInt for instant pierce ≥ 5]
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5, 0.5]));
    expect(after.actors[player.id].currentHp).toBe(50); // player dodged, no damage
    expect(after.actors[enemy.id].currentHp).toBeLessThan(200); // Instant Pierce hit
  });

  it("Instant Pierce action log is emitted", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeInstantPierceCtx(noPrepActivity, pierceRotation);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5, 0.5]));
    const reactionLog = after.logs.find(
      (l) => l.type === "action_selected" && l.abilityId === "ability_instant_pierce"
    );
    expect(reactionLog).toBeDefined();
    expect(reactionLog?.actorId).toBe(player.id);
  });

  it("Instant Pierce applies attack_damage_down to the enemy", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeInstantPierceCtx(noPrepActivity, pierceRotation);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    // Bleed chance 0.5 — provide a high RNG value so bleed does NOT proc, then damage roll
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5, 0.9]));
    const attackDownOnEnemy = after.actors[enemy.id].activeEffects.find(
      (e) => e.effectId === "effect_attack_damage_down"
    );
    expect(attackDownOnEnemy).toBeDefined();
  });

  it("Instant Pierce does not consume the main action (main attack also lands)", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    // Enemy also dodges → enemy fires Instant Pierce too (not relevant here)
    // We only care that the player's main fixed-slash still fires
    const ctx = makeInstantPierceCtx(noPrepActivity, pierceRotation);
    // dodgeChance = 0 → no dodge, Instant Pierce should NOT fire
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    // Player takes fixedSlash = 5 damage; no dodge, no Instant Pierce
    expect(after.actors[player.id].currentHp).toBe(195);
    const reactionLog = after.logs.find(
      (l) => l.abilityId === "ability_instant_pierce"
    );
    expect(reactionLog).toBeUndefined();
  });

  it("Instant Pierce does not fire when on internal cooldown", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeInstantPierceCtx(noPrepActivity, pierceRotation);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    // Pre-inject Instant Pierce cooldown on the player (2 → after tick-down = 1 → still on cooldown)
    state = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          cooldowns: { ability_instant_pierce: 2 },
        },
      },
    };
    const enemyHpBefore = state.actors[enemy.id].currentHp;
    // RNG 0.0 → dodge check passes; reaction must be skipped due to cooldown
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5]));
    const reactionLog = after.logs.find(
      (l) => l.abilityId === "ability_instant_pierce"
    );
    expect(reactionLog).toBeUndefined();
    // Enemy should also take main-action damage but NOT reaction damage.
    // Player's rotation is fixedSlash (5), so enemy hp = 200 - 5 = 195
    expect(after.actors[enemy.id].currentHp).toBe(enemyHpBefore - 5);
  });

  it("Instant Pierce fires at most once per tick even if player dodges multiple attacks", () => {
    // Use a two-enemy variant to have two incoming attacks on the player
    const twoEnemyActivity: CombatActivityDefinition = {
      id: "activity_two_enemies",
      displayName: "Two Enemies",
      playerActorId: "actor_test_player",
      enemyActorIds: ["actor_test_enemy", "actor_test_enemy_2"],
      prepTicks: 0,
      difficulty: "story",
    };
    const enemy1: EnemyDefinition = { ...makeLowHpEnemy(200), id: "actor_test_enemy" };
    const enemy2: EnemyDefinition = { ...makeLowHpEnemy(200), id: "actor_test_enemy_2" };
    const player = makeLowHpPlayer(50);

    const ctx: CombatTickContext = {
      activity: twoEnemyActivity,
      abilities: {
        ability_fixed_slash: fixedSlash,
        ability_instant_pierce: instantPierce,
        ability_auto_attack: autoAttack,
      },
      effects: {
        effect_bleeding: bleedingEffect,
        effect_attack_damage_down: attackDamageDownEffect,
      },
      rotations: {
        [player.id]: pierceRotation,
        [enemy1.id]: singleAbilityRotation("ability_fixed_slash"),
        [enemy2.id]: singleAbilityRotation("ability_fixed_slash"),
      },
    };

    let state = createInitialCombatState(twoEnemyActivity, player, [enemy1, enemy2]);
    state = {
      ...state,
      actors: { ...state.actors, [player.id]: { ...state.actors[player.id], dodgeChance: 1 } },
    };

    // Many RNG values to cover both dodge checks + reaction + any bleed procs
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.0, 0.5, 0.9, 0.5]));

    const reactionLogs = after.logs.filter(
      (l) => l.type === "action_selected" && l.abilityId === "ability_instant_pierce"
    );
    // Reaction fires exactly once, not twice
    expect(reactionLogs).toHaveLength(1);
  });

  it("Instant Pierce places the ability on cooldown", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeInstantPierceCtx(noPrepActivity, pierceRotation);
    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = withDodgeChance(state, player.id, 1);
    const after = runTick(state, ctx, new TestCombatRng([0.0, 0.5, 0.9]));
    expect(after.actors[player.id].cooldowns["ability_instant_pierce"]).toBeGreaterThan(0);
  });
});

describe("createInitialCombatState — dodgeChance from definition", () => {
  it("copies dodgeChance from actor definition to actor combat state", () => {
    const player: ActorDefinition = { ...makeLowHpPlayer(50), dodgeChance: 0.25 };
    const enemy = makeLowHpEnemy(50);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    expect(state.actors[player.id].dodgeChance).toBe(0.25);
  });

  it("dodgeChance is undefined when not set on definition", () => {
    const player = makeLowHpPlayer(50);
    const enemy = makeLowHpEnemy(50);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    expect(state.actors[player.id].dodgeChance).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MVP effects system — acceptance criteria
// ---------------------------------------------------------------------------

describe("MVP effects — bleed timing", () => {
  /** Ability that applies bleed to the main target (piercing hit so dotBaseAmount > 0). */
  const applyBleedAbility: AbilityDefinition = {
    id: "ability_apply_bleed",
    displayName: "Apply Bleed",
    tags: ["attack", "melee"],
    abilityType: "attack",
    targetRule: "main_target",
    consumesAction: true,
    cooldownTicks: 0,
    damagePackets: [{ damageType: "piercing", interval: { min: 5, max: 5 } }],
    appliesEffects: [
      { effectId: "effect_bleeding", stacks: 1, target: "main_target" },
    ],
  };

  function makeBleedCtx(activity: CombatActivityDefinition): CombatTickContext {
    return {
      activity,
      abilities: {
        ability_apply_bleed: applyBleedAbility,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_bleeding: bleedingEffect },
      rotations: {
        [activity.playerActorId]: singleAbilityRotation("ability_apply_bleed"),
        [activity.enemyActorIds[0]]: singleAbilityRotation("ability_auto_attack"),
      },
    };
  }

  it("bleed is not present before being applied", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    expect(state.actors[enemy.id].activeEffects).toHaveLength(0);
  });

  it("bleed does NOT deal tick damage on the same tick it is applied", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeBleedCtx(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));

    // Bleed should be applied this tick
    const bleedInstance = after.actors[enemy.id].activeEffects.find(
      (e) => e.effectId === "effect_bleeding"
    );
    expect(bleedInstance).toBeDefined();

    // No effect_tick log should appear on the same tick bleed is applied
    const dotTickLogs = after.logs.filter((l) => l.type === "effect_tick");
    expect(dotTickLogs).toHaveLength(0);
  });

  it("bleed deals tick damage on the following tick", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeBleedCtx(noPrepActivity);
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    // Tick 1: bleed applied, no tick damage yet
    const after1 = runTick(state, ctx, new TestCombatRng([0.5]));
    const bleedAfterTick1 = after1.actors[enemy.id].activeEffects.find(
      (e) => e.effectId === "effect_bleeding"
    );
    expect(bleedAfterTick1).toBeDefined();

    // Tick 2: bleed ticks
    const after2 = runTick(after1, ctx, new TestCombatRng([0.5]));
    const dotTickLogs = after2.logs.filter((l) => l.type === "effect_tick");
    expect(dotTickLogs).toHaveLength(1);
    expect(dotTickLogs[0].effectId).toBe("effect_bleeding");
    expect(dotTickLogs[0].actorId).toBe(enemy.id);
  });

  it("bleed is source-specific: two separate sources create independent instances", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makeBleedCtx(noPrepActivity);
    // Pre-seed the enemy with a bleed from a different source
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const stateWithExistingBleed = {
      ...state,
      actors: {
        ...state.actors,
        [enemy.id]: {
          ...state.actors[enemy.id],
          activeEffects: [
            {
              effectId: "effect_bleeding",
              sourceActorId: "actor_other_source",
              targetActorId: enemy.id,
              stacks: 1,
              remainingTicks: bleedingEffect.durationTicks,
              metadata: { dotBaseAmount: 5 },
            },
          ],
        },
      },
    };

    const after = runTick(stateWithExistingBleed, ctx, new TestCombatRng([0.5]));
    // Player applies bleed from a different source → two separate instances
    const bleedInstances = after.actors[enemy.id].activeEffects.filter(
      (e) => e.effectId === "effect_bleeding"
    );
    expect(bleedInstances).toHaveLength(2);
    expect(bleedInstances.some((e) => e.sourceActorId === "actor_other_source")).toBe(true);
    expect(bleedInstances.some((e) => e.sourceActorId === player.id)).toBe(true);
  });
});

describe("MVP effects — attack_damage_down reduces direct damage", () => {
  it("attack_damage_down reduces outgoing damage by approximately 5%", () => {
    // fixedSlash = 5 damage; with 0.95 multiplier → Math.round(5 * 0.95) = 5 (rounds up from 4.75)
    // Use a custom attack that produces a round number after the modifier
    const fixedTenSlash: AbilityDefinition = {
      id: "ability_fixed_ten",
      displayName: "Fixed Ten",
      tags: ["attack", "melee"],
      abilityType: "attack",
      targetRule: "main_target",
      consumesAction: true,
      cooldownTicks: 0,
      damagePackets: [{ damageType: "slashing", interval: { min: 20, max: 20 } }],
    };

    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_fixed_ten: fixedTenSlash,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_attack_damage_down: attackDamageDownEffect },
      rotations: {
        [player.id]: singleAbilityRotation("ability_fixed_ten"),
        [enemy.id]: singleAbilityRotation("ability_auto_attack"),
      },
    };

    // Baseline: player attacks without debuff → 20 damage
    const baseState = createInitialCombatState(noPrepActivity, player, [enemy]);
    const baseAfter = runTick(baseState, ctx, new TestCombatRng([0.5]));
    const baseDmgLog = baseAfter.logs.find(
      (l) => l.type === "damage" && l.actorId === player.id
    );
    expect(baseDmgLog?.amount).toBe(20);

    // With attack_damage_down on player → Math.round(20 * 0.95) = 19
    const stateWithDebuff = {
      ...baseState,
      actors: {
        ...baseState.actors,
        [player.id]: {
          ...baseState.actors[player.id],
          activeEffects: [
            {
              effectId: "effect_attack_damage_down",
              sourceActorId: enemy.id,
              targetActorId: player.id,
              stacks: 1,
              remainingTicks: attackDamageDownEffect.durationTicks,
            },
          ],
        },
      },
    };
    const debuffAfter = runTick(stateWithDebuff, ctx, new TestCombatRng([0.5]));
    const debuffDmgLog = debuffAfter.logs.find(
      (l) => l.type === "damage" && l.actorId === player.id
    );
    expect(debuffDmgLog?.amount).toBe(19);
  });

  it("attack_damage_down expires after its duration ticks", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_fixed_slash: fixedSlash,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_attack_damage_down: attackDamageDownEffect },
      rotations: {
        [player.id]: singleAbilityRotation("ability_fixed_slash"),
        [enemy.id]: singleAbilityRotation("ability_auto_attack"),
      },
    };

    let state = createInitialCombatState(noPrepActivity, player, [enemy]);
    state = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          activeEffects: [
            {
              effectId: "effect_attack_damage_down",
              sourceActorId: enemy.id,
              targetActorId: player.id,
              stacks: 1,
              remainingTicks: attackDamageDownEffect.durationTicks,
            },
          ],
        },
      },
    };

    // Run 3 ticks (duration) — effect should be gone after
    let s = state;
    for (let i = 0; i < 3; i++) {
      s = runTick(s, ctx, new TestCombatRng([0.5]));
    }
    const remaining = s.actors[player.id].activeEffects.filter(
      (e) => e.effectId === "effect_attack_damage_down"
    );
    expect(remaining).toHaveLength(0);
  });
});

describe("MVP effects — piercing_talon stacks consumed by finisher", () => {
  /** Build a context with the short blade abilities and effects. */
  function makePiercingTalonCtx(activity: CombatActivityDefinition): CombatTickContext {
    return {
      activity,
      abilities: {
        ability_piercing_finisher: piercingFinisher,
        ability_slashing_cut: slashingCut,
        ability_auto_attack: autoAttack,
      },
      effects: {
        effect_piercing_talon: piercingTalonStack,
      },
      rotations: {
        [activity.playerActorId]: singleAbilityRotation("ability_piercing_finisher"),
        [activity.enemyActorIds[0]]: singleAbilityRotation("ability_auto_attack"),
      },
    };
  }

  it("2 piercing_talon stacks are consumed when piercing finisher fires", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makePiercingTalonCtx(noPrepActivity);

    // Pre-seed player with exactly 2 piercing_talon stacks
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const stateWithTalons = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          activeEffects: [
            {
              effectId: "effect_piercing_talon",
              sourceActorId: player.id,
              targetActorId: player.id,
              stacks: 2,
            },
          ],
        },
      },
    };

    const after = runTick(stateWithTalons, ctx, new TestCombatRng([0.5]));
    // All stacks consumed → effect should be gone
    const talonInstance = after.actors[player.id].activeEffects.find(
      (e) => e.effectId === "effect_piercing_talon"
    );
    expect(talonInstance).toBeUndefined();
  });

  it("consuming piercing_talon logs an effect_expired entry", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makePiercingTalonCtx(noPrepActivity);

    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const stateWithTalons = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          activeEffects: [
            {
              effectId: "effect_piercing_talon",
              sourceActorId: player.id,
              targetActorId: player.id,
              stacks: 2,
            },
          ],
        },
      },
    };

    const after = runTick(stateWithTalons, ctx, new TestCombatRng([0.5]));
    const expiredLog = after.logs.find(
      (l) => l.type === "effect_expired" && l.effectId === "effect_piercing_talon"
    );
    expect(expiredLog).toBeDefined();
  });

  it("consuming piercing_talon adds to effectsExpired in the accumulated delta", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makePiercingTalonCtx(noPrepActivity);

    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const stateWithTalons = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          activeEffects: [
            {
              effectId: "effect_piercing_talon",
              sourceActorId: player.id,
              targetActorId: player.id,
              stacks: 2,
            },
          ],
        },
      },
    };

    const after = runTick(stateWithTalons, ctx, new TestCombatRng([0.5]));
    const expiredDelta = after.accumulatedDelta.effectsExpired.find(
      (e) => e.effectId === "effect_piercing_talon"
    );
    expect(expiredDelta).toBeDefined();
    expect(expiredDelta?.stacks).toBe(2);
  });

  it("excess piercing_talon stacks beyond 2 are preserved after finisher", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx = makePiercingTalonCtx(noPrepActivity);

    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const stateWithTalons = {
      ...state,
      actors: {
        ...state.actors,
        [player.id]: {
          ...state.actors[player.id],
          activeEffects: [
            {
              effectId: "effect_piercing_talon",
              sourceActorId: player.id,
              targetActorId: player.id,
              stacks: 3,
            },
          ],
        },
      },
    };

    const after = runTick(stateWithTalons, ctx, new TestCombatRng([0.5]));
    const talonInstance = after.actors[player.id].activeEffects.find(
      (e) => e.effectId === "effect_piercing_talon"
    );
    expect(talonInstance).toBeDefined();
    expect(talonInstance?.stacks).toBe(1);
  });
});

describe("MVP effects — effect changes logged and in delta", () => {
  it("effectsApplied in accumulated delta contains entry when an effect is applied", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_apply_flat_dot: applyFlatDotAbility,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_flat_dot: flatDotEffect },
      rotations: {
        [player.id]: singleAbilityRotation("ability_apply_flat_dot"),
        [enemy.id]: singleAbilityRotation("ability_auto_attack"),
      },
    };
    const state = createInitialCombatState(noPrepActivity, player, [enemy]);
    const after = runTick(state, ctx, new TestCombatRng([0.5]));
    expect(after.accumulatedDelta.effectsApplied).toHaveLength(1);
    expect(after.accumulatedDelta.effectsApplied[0].effectId).toBe("effect_flat_dot");
  });

  it("effectsExpired in accumulated delta contains entry when an effect expires", () => {
    const player = makeLowHpPlayer(200);
    const enemy = makeLowHpEnemy(200);
    const ctx: CombatTickContext = {
      activity: noPrepActivity,
      abilities: {
        ability_fixed_slash: fixedSlash,
        ability_auto_attack: autoAttack,
      },
      effects: { effect_flat_dot: flatDotEffect },
      rotations: {
        [player.id]: singleAbilityRotation("ability_fixed_slash"),
        [enemy.id]: singleAbilityRotation("ability_auto_attack"),
      },
    };
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
    expect(after.accumulatedDelta.effectsExpired).toHaveLength(1);
    expect(after.accumulatedDelta.effectsExpired[0].effectId).toBe("effect_flat_dot");
  });
});
