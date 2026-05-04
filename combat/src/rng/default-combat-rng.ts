import type { CombatRng } from "./combat-rng";

/**
 * Production RNG backed by Math.random().
 */
export class DefaultCombatRng implements CombatRng {
  rollInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return Math.random() < probability;
  }
}
