import { CombatEngine } from "./combat-engine";
import { TestCombatRng } from "../rng/test-combat-rng";
import type { DamagePacket, EffectApplicationDefinition } from "@rinner/grayvale-core";

const piercingPacket: DamagePacket = {
  damageType: "piercing",
  interval: { min: 3, max: 7 }
};

const slashingPacket: DamagePacket = {
  damageType: "slashing",
  interval: { min: 2, max: 6 }
};

const bleedApplication: EffectApplicationDefinition = {
  effectId: "effect_bleeding",
  chance: 0.6,
  stacks: 1,
  target: "main_target"
};

describe("CombatEngine.rollDamage — deterministic", () => {
  it("rolls the minimum damage when RNG returns 0", () => {
    const engine = new CombatEngine(new TestCombatRng([0]));
    expect(engine.rollDamage(piercingPacket)).toBe(3);
  });

  it("rolls the maximum damage when RNG returns a value just below 1", () => {
    const engine = new CombatEngine(new TestCombatRng([0.9999]));
    expect(engine.rollDamage(piercingPacket)).toBe(7);
  });

  it("rolls a deterministic mid-range value", () => {
    // 0.5 * (7 - 3 + 1) + 3 = 0.5 * 5 + 3 = 5
    const engine = new CombatEngine(new TestCombatRng([0.5]));
    expect(engine.rollDamage(piercingPacket)).toBe(5);
  });

  it("rolls correct minimum for slashing packet", () => {
    const engine = new CombatEngine(new TestCombatRng([0]));
    expect(engine.rollDamage(slashingPacket)).toBe(2);
  });

  it("rolls correct maximum for slashing packet", () => {
    const engine = new CombatEngine(new TestCombatRng([0.9999]));
    expect(engine.rollDamage(slashingPacket)).toBe(6);
  });

  it("produces independent rolls for successive packets", () => {
    const engine = new CombatEngine(new TestCombatRng([0, 0.9999]));
    expect(engine.rollDamage(piercingPacket)).toBe(3);
    expect(engine.rollDamage(slashingPacket)).toBe(6);
  });
});

describe("CombatEngine.checkDodge — deterministic", () => {
  it("is dodged when RNG value is below dodge chance", () => {
    const engine = new CombatEngine(new TestCombatRng([0.1]));
    expect(engine.checkDodge(0.3)).toBe(true);
  });

  it("is not dodged when RNG value equals dodge chance", () => {
    const engine = new CombatEngine(new TestCombatRng([0.3]));
    expect(engine.checkDodge(0.3)).toBe(false);
  });

  it("is not dodged when RNG value exceeds dodge chance", () => {
    const engine = new CombatEngine(new TestCombatRng([0.5]));
    expect(engine.checkDodge(0.3)).toBe(false);
  });

  it("dodge chance of 0 never dodges", () => {
    const engine = new CombatEngine(new TestCombatRng([0]));
    expect(engine.checkDodge(0)).toBe(false);
  });
});

describe("CombatEngine.checkEffectApplication — deterministic (bleed)", () => {
  it("applies bleed when RNG value is below the proc chance", () => {
    const engine = new CombatEngine(new TestCombatRng([0.59]));
    expect(engine.checkEffectApplication(bleedApplication)).toBe(true);
  });

  it("does not apply bleed when RNG value equals the proc chance", () => {
    const engine = new CombatEngine(new TestCombatRng([0.6]));
    expect(engine.checkEffectApplication(bleedApplication)).toBe(false);
  });

  it("does not apply bleed when RNG value exceeds the proc chance", () => {
    const engine = new CombatEngine(new TestCombatRng([0.9]));
    expect(engine.checkEffectApplication(bleedApplication)).toBe(false);
  });

  it("always applies when no chance is specified (defaults to 1)", () => {
    const guaranteed: EffectApplicationDefinition = {
      effectId: "effect_bleeding",
      stacks: 1,
      target: "main_target"
    };
    const engine = new CombatEngine(new TestCombatRng([0.9999]));
    expect(engine.checkEffectApplication(guaranteed)).toBe(true);
  });
});

describe("CombatEngine — default RNG (smoke test)", () => {
  it("can be constructed without providing an RNG", () => {
    expect(() => new CombatEngine()).not.toThrow();
  });

  it("rollDamage stays within the packet interval", () => {
    const engine = new CombatEngine();
    for (let i = 0; i < 20; i++) {
      const dmg = engine.rollDamage(piercingPacket);
      expect(dmg).toBeGreaterThanOrEqual(piercingPacket.interval.min);
      expect(dmg).toBeLessThanOrEqual(piercingPacket.interval.max);
    }
  });
});
