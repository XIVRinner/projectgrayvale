import type { CombatRng } from "./combat-rng";

/**
 * Deterministic RNG for tests.
 *
 * Accepts a pre-defined sequence of floats in [0, 1).  Each call to
 * `rollInt` or `chance` consumes the next value in the sequence; when
 * the sequence is exhausted it wraps around.
 *
 * @example
 * const rng = new TestCombatRng([0.0, 0.99, 0.5]);
 * rng.rollInt(1, 6); // => 1  (0.0 * 6 + 1 = 1)
 * rng.rollInt(1, 6); // => 6  (0.99 * 6 + 1 ≈ 6)
 * rng.chance(0.6);   // => false (0.5 >= 0.6)
 */
export class TestCombatRng implements CombatRng {
  private readonly values: readonly number[];
  private index = 0;

  constructor(values: number[]) {
    if (values.length === 0) {
      throw new Error("TestCombatRng: values array must not be empty");
    }
    this.values = values;
  }

  private next(): number {
    const v = this.values[this.index % this.values.length];
    this.index++;
    return v;
  }

  rollInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
