/**
 * End-to-end: Old Dagger (player) vs Coyote (enemy)
 *
 * Runs the full MVP combat scenario from initial state through
 * finalizeCombat with a deterministic RNG and verifies every acceptance
 * criterion from the issue:
 *
 *  - Combat reaches a deterministic outcome (victory or defeat).
 *  - Logs are produced across all ticks.
 *  - A CombatDelta is produced without runtime errors.
 *  - XP delta entries appear on victory.
 */
import {
  createInitialCombatState,
  runCombat,
  finalizeCombat,
  TestCombatRng,
  compileShortBladeRotation,
  compileCoyoteRotation,
} from "../index";
import type { CombatTickContext } from "../index";
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
  oldDagger,
} from "@rinner/grayvale-core";

// ---------------------------------------------------------------------------
// Shared context
//
// The context wires together abilities, effects, rotations, XP definitions,
// and the difficulty profile so that every acceptance criterion can be
// verified in a single run.
// ---------------------------------------------------------------------------

const mvpCtx: CombatTickContext = {
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
    [mvpCombatActivity.playerActorId]: compileShortBladeRotation(
      [oldDagger],
      shortBladeSkill
    ),
    [mvpCombatActivity.enemyActorIds[0]]: compileCoyoteRotation(),
  },
  enemyXp: {
    [coyoteEnemy.id]: coyoteEnemy.xp,
  },
  difficultyProfiles: {
    [storyDifficultyProfile.id]: storyDifficultyProfile,
  },
  equipment: {
    [oldDagger.id]: oldDagger,
  },
  playerEquipment: playerActor.equipment,
};

// ---------------------------------------------------------------------------
// Victory path — high-damage RNG ensures the player kills the coyote
// ---------------------------------------------------------------------------

describe("e2e: Old Dagger vs Coyote — victory path", () => {
  let final: ReturnType<typeof runCombat>;
  let delta: ReturnType<typeof finalizeCombat>;

  beforeAll(() => {
    const initial = createInitialCombatState(
      mvpCombatActivity,
      playerActor,
      [coyoteEnemy]
    );
    final = runCombat(initial, mvpCtx, new TestCombatRng([0.9]));
    delta = finalizeCombat(final);
  });

  // Outcome
  it("combat phase is 'ended' after runCombat", () => {
    expect(final.phase).toBe("ended");
  });

  it("high-damage RNG produces a player victory", () => {
    expect(final.outcome).toBe("victory");
  });

  // Logs
  it("logs are produced", () => {
    expect(delta.logs.length).toBeGreaterThan(0);
  });

  it("logs include prep tick entries", () => {
    const prepLogs = delta.logs.filter((l) => l.type === "prep");
    expect(prepLogs.length).toBe(mvpCombatActivity.prepTicks);
  });

  it("logs include damage entries", () => {
    const damageLogs = delta.logs.filter((l) => l.type === "damage");
    expect(damageLogs.length).toBeGreaterThan(0);
  });

  it("logs include an outcome entry", () => {
    const outcomeLogs = delta.logs.filter((l) => l.type === "outcome");
    expect(outcomeLogs.length).toBeGreaterThan(0);
  });

  // Delta
  it("delta is produced", () => {
    expect(delta).toBeDefined();
  });

  it("delta outcome matches final state outcome", () => {
    expect(delta.outcome).toBe(final.outcome);
  });

  it("delta actorChanges contains at least one entry", () => {
    expect(delta.actorChanges.length).toBeGreaterThan(0);
  });

  // XP on victory
  it("XP delta entries are present on victory", () => {
    expect(delta.xp.length).toBeGreaterThan(0);
  });

  it("XP delta contains a character XP entry targeting the player", () => {
    const charXp = delta.xp.find((x) => x.xpType === "character");
    expect(charXp).toBeDefined();
    expect(charXp?.targetActorId).toBe(playerActor.id);
    expect(charXp?.amount).toBeGreaterThan(0);
  });

  it("XP delta contains a skill XP entry for the short blade skill", () => {
    const skillXp = delta.xp.find(
      (x) => x.xpType === "skill" && x.skillId === shortBladeSkill.id
    );
    expect(skillXp).toBeDefined();
    expect(skillXp?.targetActorId).toBe(playerActor.id);
    expect(skillXp?.amount).toBeGreaterThan(0);
  });

  // No death penalty on victory
  it("no death penalty is applied on victory", () => {
    expect(delta.penalties).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Defeat path — very low player HP ensures the coyote wins
// ---------------------------------------------------------------------------

describe("e2e: Old Dagger vs Coyote — defeat path", () => {
  let final: ReturnType<typeof runCombat>;
  let delta: ReturnType<typeof finalizeCombat>;

  beforeAll(() => {
    const weakPlayer = { ...playerActor, maxHp: 1 };
    const initial = createInitialCombatState(
      mvpCombatActivity,
      weakPlayer,
      [coyoteEnemy]
    );
    final = runCombat(initial, mvpCtx, new TestCombatRng([0.5]));
    delta = finalizeCombat(final);
  });

  it("defeat path produces 'defeat' outcome", () => {
    expect(final.outcome).toBe("defeat");
  });

  it("delta xp is empty on defeat", () => {
    expect(delta.xp).toHaveLength(0);
  });

  it("death penalty is present on defeat", () => {
    const penalty = delta.penalties.find(
      (p) => p.penaltyType === "death_attack_lockout"
    );
    expect(penalty).toBeDefined();
    expect(penalty?.targetActorId).toBe(playerActor.id);
    expect(penalty?.durationSeconds).toBeGreaterThan(0);
  });
});
