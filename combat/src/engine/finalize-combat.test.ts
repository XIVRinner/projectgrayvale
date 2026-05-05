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
  EnemyXpDefinition,
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
  storyDifficultyProfile,
  leatherChestpiece,
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

// ---------------------------------------------------------------------------
// finalizeCombat — XP entries on victory
// ---------------------------------------------------------------------------

// armorSkillXp is a required field of EnemyXpDefinition but is not accumulated
// in the MVP because the player has no armor skill in their rotation. It is
// present in the fixture only to satisfy the type; see the "armor skill XP"
// test below.
const testEnemyXp: EnemyXpDefinition = {
  characterXp: 10,
  offensiveSkillXp: 5,
  armorSkillXp: 3,
};

function makeContextWithEnemyXp(activity: CombatActivityDefinition): CombatTickContext {
  return {
    ...makeContext(activity),
    enemyXp: {
      [activity.enemyActorIds[0]]: testEnemyXp,
    },
  };
}

describe("finalizeCombat — XP entries on victory", () => {
  it("delta xp includes a character XP entry targeting the player", () => {
    const ctx = makeContextWithEnemyXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const charXp = delta.xp.find((x) => x.xpType === "character");
    expect(charXp).toBeDefined();
    expect(charXp?.amount).toBe(testEnemyXp.characterXp);
    expect(charXp?.targetActorId).toBe(noPrepActivity.playerActorId);
  });

  it("delta xp includes a skill XP entry with the player rotation skillId", () => {
    const ctx = makeContextWithEnemyXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const skillXp = delta.xp.find((x) => x.xpType === "skill");
    expect(skillXp).toBeDefined();
    expect(skillXp?.amount).toBe(testEnemyXp.offensiveSkillXp);
    expect(skillXp?.skillId).toBe("skill_test");
    expect(skillXp?.targetActorId).toBe(noPrepActivity.playerActorId);
  });

  it("armorSkillXp is not accumulated (no armor skill in player rotation)", () => {
    const ctx = makeContextWithEnemyXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    // Only character + offensive skill entries expected; no armor skill entry.
    expect(delta.xp.every((x) => x.xpType !== "skill" || x.skillId !== undefined)).toBe(true);
    expect(delta.xp.length).toBe(2);
  });

  it("delta xp is empty on victory when enemyXp is not provided in context", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.xp).toHaveLength(0);
  });

  it("delta xp is empty on defeat", () => {
    const ctx = makeContextWithEnemyXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(5),
      [makeLowHpEnemy(1000)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.xp).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — death penalty on defeat
// ---------------------------------------------------------------------------

describe("finalizeCombat — death penalty on defeat", () => {
  it("delta penalties contains a death_attack_lockout entry targeting the player", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(5),
      [makeLowHpEnemy(1000)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.penalties).toHaveLength(1);
    expect(delta.penalties[0].penaltyType).toBe("death_attack_lockout");
    expect(delta.penalties[0].targetActorId).toBe(noPrepActivity.playerActorId);
    expect(delta.penalties[0].durationSeconds).toBeGreaterThan(0);
  });

  it("delta penalties is empty on victory", () => {
    const ctx = makeContext(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.penalties).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — fled outcome passes through
// ---------------------------------------------------------------------------

describe("finalizeCombat — fled outcome", () => {
  it("carries the fled outcome into the delta", () => {
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(1000)]
    );
    const fledState: CombatRunState = { ...initial, phase: "ended", outcome: "fled" };
    const delta = finalizeCombat(fledState);
    expect(delta.outcome).toBe("fled");
  });

  it("delta xp is empty on fled", () => {
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(1000)]
    );
    const fledState: CombatRunState = { ...initial, phase: "ended", outcome: "fled" };
    const delta = finalizeCombat(fledState);
    expect(delta.xp).toHaveLength(0);
  });

  it("delta penalties is empty on fled", () => {
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(1000)]
    );
    const fledState: CombatRunState = { ...initial, phase: "ended", outcome: "fled" };
    const delta = finalizeCombat(fledState);
    expect(delta.penalties).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — difficulty magic number scales XP
// ---------------------------------------------------------------------------

describe("finalizeCombat — difficulty magic number scales XP", () => {
  // story difficulty xpMagicNumber is 0.75
  // Math.floor(10 * 0.75) = 7
  // Math.floor(5  * 0.75) = 3
  it("character XP is scaled by the difficulty magic number", () => {
    const ctx: CombatTickContext = {
      ...makeContextWithEnemyXp(noPrepActivity),
      difficultyProfiles: { story: storyDifficultyProfile },
    };
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const charXp = delta.xp.find((x) => x.xpType === "character");
    expect(charXp?.amount).toBe(Math.floor(testEnemyXp.characterXp * storyDifficultyProfile.xpMagicNumber));
  });

  it("offensive skill XP is scaled by the difficulty magic number", () => {
    const ctx: CombatTickContext = {
      ...makeContextWithEnemyXp(noPrepActivity),
      difficultyProfiles: { story: storyDifficultyProfile },
    };
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const skillXp = delta.xp.find((x) => x.xpType === "skill");
    expect(skillXp?.amount).toBe(Math.floor(testEnemyXp.offensiveSkillXp * storyDifficultyProfile.xpMagicNumber));
  });

  it("XP amounts are unchanged when no difficulty profiles are provided", () => {
    const ctx = makeContextWithEnemyXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const charXp = delta.xp.find((x) => x.xpType === "character");
    const skillXp = delta.xp.find((x) => x.xpType === "skill");
    expect(charXp?.amount).toBe(testEnemyXp.characterXp);
    expect(skillXp?.amount).toBe(testEnemyXp.offensiveSkillXp);
  });
});

// ---------------------------------------------------------------------------
// finalizeCombat — armor skill XP
// ---------------------------------------------------------------------------

describe("finalizeCombat — armor skill XP", () => {
  function makeContextWithArmorAndXp(activity: CombatActivityDefinition): CombatTickContext {
    return {
      ...makeContextWithEnemyXp(activity),
      equipment: { [leatherChestpiece.id]: leatherChestpiece },
      playerEquipment: { chest: leatherChestpiece.id },
    };
  }

  it("armor skill XP entry is emitted when armor is equipped", () => {
    const ctx = makeContextWithArmorAndXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const armorXp = delta.xp.find(
      (x) => x.xpType === "skill" && x.skillId === leatherChestpiece.armorSkill
    );
    expect(armorXp).toBeDefined();
    expect(armorXp?.targetActorId).toBe(noPrepActivity.playerActorId);
  });

  it("armor XP amount applies slot weight (floor of armorSkillXp × slotWeight)", () => {
    const ctx = makeContextWithArmorAndXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const armorXp = delta.xp.find(
      (x) => x.xpType === "skill" && x.skillId === leatherChestpiece.armorSkill
    );
    const expected = Math.floor(
      testEnemyXp.armorSkillXp * (leatherChestpiece.armorSlotWeight ?? 0)
    );
    expect(armorXp?.amount).toBe(expected);
  });

  it("armor XP is also scaled by the difficulty magic number", () => {
    // Use armorSkillXp: 12 so that floor(12 × 0.35 × 0.75) = floor(3.15) = 3 (non-zero).
    // characterXp: 20 and offensiveSkillXp: 16 are arbitrary non-zero values to ensure
    // those entries are also present; only armorSkillXp is the focus of this test.
    const armorScalingXp: EnemyXpDefinition = { characterXp: 20, offensiveSkillXp: 16, armorSkillXp: 12 };
    const ctx: CombatTickContext = {
      ...makeContext(noPrepActivity),
      enemyXp: { [noPrepActivity.enemyActorIds[0]]: armorScalingXp },
      difficultyProfiles: { story: storyDifficultyProfile },
      equipment: { [leatherChestpiece.id]: leatherChestpiece },
      playerEquipment: { chest: leatherChestpiece.id },
    };
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    const armorXp = delta.xp.find(
      (x) => x.xpType === "skill" && x.skillId === leatherChestpiece.armorSkill
    );
    const expected = Math.floor(
      armorScalingXp.armorSkillXp *
        (leatherChestpiece.armorSlotWeight ?? 0) *
        storyDifficultyProfile.xpMagicNumber
    );
    expect(armorXp).toBeDefined();
    expect(armorXp?.amount).toBe(expected);
  });

  it("no armor XP when equipment map is absent", () => {
    const ctx = makeContextWithEnemyXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    // Only character + offensive skill — no armor entry
    expect(delta.xp.length).toBe(2);
  });

  it("no armor XP when playerEquipment is absent", () => {
    const ctx: CombatTickContext = {
      ...makeContextWithEnemyXp(noPrepActivity),
      equipment: { [leatherChestpiece.id]: leatherChestpiece },
      // playerEquipment intentionally omitted
    };
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(1000),
      [makeLowHpEnemy(5)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.xp.length).toBe(2);
  });

  it("armor XP is absent on defeat even when armor is equipped", () => {
    const ctx = makeContextWithArmorAndXp(noPrepActivity);
    const initial = createInitialCombatState(
      noPrepActivity,
      makeLowHpPlayer(5),
      [makeLowHpEnemy(1000)]
    );
    const final = runCombat(initial, ctx, new TestCombatRng([0.5]));
    const delta = finalizeCombat(final);
    expect(delta.xp).toHaveLength(0);
  });
});
