import { TestCombatRng } from "./test-combat-rng";
import { DefaultCombatRng } from "./default-combat-rng";

describe("TestCombatRng", () => {
  it("throws when given an empty values array", () => {
    expect(() => new TestCombatRng([])).toThrow();
  });

  it("rollInt returns deterministic minimum when value is 0", () => {
    const rng = new TestCombatRng([0]);
    expect(rng.rollInt(1, 6)).toBe(1);
  });

  it("rollInt returns deterministic maximum when value is just below 1", () => {
    const rng = new TestCombatRng([0.9999]);
    expect(rng.rollInt(1, 6)).toBe(6);
  });

  it("rollInt returns a mid-range value deterministically", () => {
    // 0.5 * (6 - 1 + 1) + 1 = 0.5 * 6 + 1 = 4
    const rng = new TestCombatRng([0.5]);
    expect(rng.rollInt(1, 6)).toBe(4);
  });

  it("chance returns false when the value equals the probability", () => {
    const rng = new TestCombatRng([0.6]);
    expect(rng.chance(0.6)).toBe(false);
  });

  it("chance returns true when the value is strictly below the probability", () => {
    const rng = new TestCombatRng([0.59]);
    expect(rng.chance(0.6)).toBe(true);
  });

  it("chance returns false when value is above the probability", () => {
    const rng = new TestCombatRng([0.7]);
    expect(rng.chance(0.6)).toBe(false);
  });

  it("cycles through values in sequence", () => {
    const rng = new TestCombatRng([0, 0.9999]);
    expect(rng.rollInt(1, 6)).toBe(1);
    expect(rng.rollInt(1, 6)).toBe(6);
  });

  it("wraps around to the start of the sequence when exhausted", () => {
    const rng = new TestCombatRng([0]);
    rng.rollInt(1, 6);
    // Second call wraps: still returns min
    expect(rng.rollInt(1, 6)).toBe(1);
  });

  it("interleaves rollInt and chance calls correctly", () => {
    // values: [0.1, 0.9, 0.4]
    const rng = new TestCombatRng([0.1, 0.9, 0.4]);
    expect(rng.rollInt(0, 9)).toBe(1);   // 0.1 * 10 = 1
    expect(rng.chance(0.5)).toBe(false); // 0.9 >= 0.5
    expect(rng.chance(0.5)).toBe(true);  // 0.4 < 0.5
  });
});

describe("DefaultCombatRng", () => {
  const rng = new DefaultCombatRng();

  it("rollInt stays within the requested range", () => {
    for (let i = 0; i < 50; i++) {
      const v = rng.rollInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it("rollInt produces an integer", () => {
    for (let i = 0; i < 20; i++) {
      expect(Number.isInteger(rng.rollInt(1, 100))).toBe(true);
    }
  });

  it("chance returns a boolean", () => {
    expect(typeof rng.chance(0.5)).toBe("boolean");
  });

  it("chance(0) is always false", () => {
    for (let i = 0; i < 20; i++) {
      expect(rng.chance(0)).toBe(false);
    }
  });

  it("chance(1) is always true", () => {
    for (let i = 0; i < 20; i++) {
      expect(rng.chance(1)).toBe(true);
    }
  });
});
