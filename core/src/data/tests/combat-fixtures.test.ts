import {
  basicThrust,
  quickSlash,
  coyoteScratch,
  playerActor,
  coyoteEnemy,
  mvpCombatActivity,
  storyDifficultyProfile,
  oldDagger,
  shortBladeSkill,
  bleedingEffect,
  piercingTalonStack,
  attackDamageDownEffect
} from "../examples/combat";

describe("MVP combat fixtures — equipment", () => {
  it("old dagger has piercing damage interval", () => {
    expect(oldDagger.damage?.piercing).toEqual({ min: 3, max: 7 });
  });

  it("old dagger has slashing damage interval", () => {
    expect(oldDagger.damage?.slashing).toEqual({ min: 2, max: 5 });
  });

  it("old dagger is associated with the short_blade skill", () => {
    expect(oldDagger.associatedSkill).toBe("skill_short_blade");
  });
});

describe("MVP combat fixtures — short blade skill", () => {
  it("short blade has a default rotation id", () => {
    expect(shortBladeSkill.defaultRotationId).toBeDefined();
    expect(shortBladeSkill.defaultRotationId).toBe("rotation_short_blade_default");
  });

  it("short blade exposes its ability ids", () => {
    expect(shortBladeSkill.abilityIds).toContain("ability_basic_thrust");
    expect(shortBladeSkill.abilityIds).toContain("ability_quick_slash");
  });
});

describe("MVP combat fixtures — short blade abilities", () => {
  it("basic thrust deals piercing damage", () => {
    expect(basicThrust.damagePackets).toHaveLength(1);
    expect(basicThrust.damagePackets![0].damageType).toBe("piercing");
  });

  it("quick slash deals slashing damage", () => {
    expect(quickSlash.damagePackets).toHaveLength(1);
    expect(quickSlash.damagePackets![0].damageType).toBe("slashing");
  });
});

describe("MVP combat fixtures — coyote Scratch ability", () => {
  it("Scratch has a 4-tick cooldown", () => {
    expect(coyoteScratch.cooldownTicks).toBe(4);
  });

  it("Scratch deals direct damage", () => {
    expect(coyoteScratch.damagePackets).toBeDefined();
    expect(coyoteScratch.damagePackets!.length).toBeGreaterThan(0);
  });

  it("Scratch applies the bleeding effect", () => {
    const bleedApplication = coyoteScratch.appliesEffects?.find(
      (e) => e.effectId === "effect_bleeding"
    );
    expect(bleedApplication).toBeDefined();
  });
});

describe("MVP combat fixtures — effects", () => {
  it("bleeding is a dot effect with duration", () => {
    expect(bleedingEffect.effectType).toBe("dot");
    expect(bleedingEffect.durationTicks).toBeGreaterThan(0);
  });

  it("piercing_talon is a resource_stack effect", () => {
    expect(piercingTalonStack.effectType).toBe("resource_stack");
  });

  it("attack_damage_down reduces damage_done via multiply modifier", () => {
    const mod = attackDamageDownEffect.modifiers?.find(
      (m) => m.target === "damage_done" && m.operation === "multiply"
    );
    expect(mod).toBeDefined();
    expect(mod!.value).toBeLessThan(1);
  });
});

describe("MVP combat fixtures — coyote enemy", () => {
  it("coyote has tags", () => {
    expect(coyoteEnemy.tags.length).toBeGreaterThan(0);
  });

  it("coyote has HP and level defined", () => {
    expect(coyoteEnemy.maxHp).toBeGreaterThan(0);
    expect(coyoteEnemy.level).toBeGreaterThan(0);
  });

  it("coyote has abilities listed", () => {
    expect(coyoteEnemy.abilities).toContain("ability_coyote_scratch");
  });

  it("coyote is typed as enemy", () => {
    expect(coyoteEnemy.enemyType).toBe("enemy");
  });
});

describe("MVP combat fixtures — player actor", () => {
  it("player actor has the old dagger equipped in main_hand", () => {
    expect(playerActor.equipment?.main_hand).toBe("item_old_dagger");
  });

  it("player actor references the short_blade skill", () => {
    expect(playerActor.skills).toContain("skill_short_blade");
  });
});

describe("MVP combat fixtures — story difficulty profile", () => {
  it("story difficulty id is 'story'", () => {
    expect(storyDifficultyProfile.id).toBe("story");
  });

  it("story difficulty has an xpMagicNumber", () => {
    expect(typeof storyDifficultyProfile.xpMagicNumber).toBe("number");
  });
});

describe("MVP combat fixtures — activity", () => {
  it("MVP activity references the player actor", () => {
    expect(mvpCombatActivity.playerActorId).toBe(playerActor.id);
  });

  it("MVP activity includes the coyote enemy", () => {
    expect(mvpCombatActivity.enemyActorIds).toContain(coyoteEnemy.id);
  });

  it("MVP activity uses story difficulty", () => {
    expect(mvpCombatActivity.difficulty).toBe("story");
  });

  it("MVP activity has 2 prep ticks", () => {
    expect(mvpCombatActivity.prepTicks).toBe(2);
  });
});
