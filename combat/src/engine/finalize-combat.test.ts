import {
  createInitialCombatState,
  runCombat,
  finalizeCombat,
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

const noPrepActivity: CombatActivityDefinition = {
  id: "activity_test",
  displayName: "Test Encounter",
  playerActorId: "actor_test_player",
  enemyActorIds: ["actor_test_enemy"],
  prepTicks: 0,
  difficulty: "story",
};

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

function makeContext(activity: CombatActivityDefinition): CombatTickContext {
  return {
    activity,
    abilities: { ability_fixed_slash: fixedSlash, ability_auto_attack: autoAttack },
    effects: {},
    rotations: {
      [activity.playerActorId]: { skillId: "skill_test", rules: [{ abilityId: "ability_fixed_slash" }] },
      [activity.enemyActorIds[0]]: { skillId: "skill_test", rules: [{ abilityId: "ability_fixed_slash" }] },
    },
  };
}

// ---------------------------------------------------------------------------
// finalizeCombat — basic contract
// ---------------------------------------------------------------------------

describe("finalizeCombat — throws when combat is not ended", () => {
  it("throws if phase is 'combat'", () => {
    const state = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(1000)]
    );
    expect(() => finalizeCombat(state)).toThrow("non-ended combat");
  });

  it("throws if phase is 'prep'", () => {
    const prepActivity: CombatActivityDefinition = {
      ...noPrepActivity,
      id: "activity_prep",
      prepTicks: 2,
    };
    const state = createInitialCombatState(
      prepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(1000)]
    );
    expect(state.phase).toBe("prep");
    expect(() => finalizeCombat(state)).toThrow("non-ended combat");
  });
});

describe("finalizeCombat — outcome and tick count", () => {
  it("carries the victory outcome into the delta", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.outcome).toBe("victory");
    expect(delta.activityId).toBe(noPrepActivity.id);
  });

  it("carries the defeat outcome into the delta", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(5),
      [makeLowHpEnemy(1000)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.outcome).toBe("defeat");
  });

  it("ticksElapsed equals the currentTick of the final state", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.ticksElapsed).toBe(final.currentTick);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — logs are included in the delta
// ---------------------------------------------------------------------------

describe("finalizeCombat — logs included in combat delta", () => {
  it("delta logs match the run state logs exactly", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.logs).toEqual(final.logs);
  });

  it("delta logs include at least one 'damage' entry", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.logs.some((l) => l.type === "damage")).toBe(true);
  });

  it("delta logs include an 'outcome' entry", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const outcomeLogs = delta.logs.filter((l) => l.type === "outcome");
    expect(outcomeLogs).toHaveLength(1);
  });

  it("every log entry has a tick number", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    for (const log of delta.logs) {
      expect(typeof log.tick).toBe("number");
    }
  });

  it("delta logs include a 'death' entry when an actor is defeated", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.logs.some((l) => l.type === "death")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — accumulated delta fields are carried through
// ---------------------------------------------------------------------------

describe("finalizeCombat — accumulated delta fields", () => {
  it("actorChanges are present in the delta", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.actorChanges.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — MVP short blade scenario
// ---------------------------------------------------------------------------

describe("finalizeCombat — MVP short blade vs coyote", () => {
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

  it("finalized delta includes all log types expected from the MVP scenario", () => {
    const initial = createInitialCombatState(
      mvpCombatActivity,
      playerActor,
      [coyoteEnemy]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.9]));
    const delta = finalizeCombat(final);

    // The MVP scenario should produce at least: prep, action_selected, damage, outcome
    const types = new Set(delta.logs.map((l) => l.type));
    expect(types.has("prep")).toBe(true);
    expect(types.has("action_selected")).toBe(true);
    expect(types.has("damage")).toBe(true);
    expect(types.has("outcome")).toBe(true);
  });

  it("logs in delta contain entries from every tick", () => {
    const initial = createInitialCombatState(
      mvpCombatActivity,
      playerActor,
      [coyoteEnemy]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.9]));
    const delta = finalizeCombat(final);

    // Ticks 0..currentTick-1 should appear in the logs
    const ticksInLogs = new Set(delta.logs.map((l) => l.tick));
    for (let t = 0; t < final.currentTick; t++) {
      expect(ticksInLogs.has(t)).toBe(true);
    }
  });
});
