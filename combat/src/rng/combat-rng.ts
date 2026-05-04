/**
 * Minimal random interface consumed by the combat engine.
 * Swap in TestCombatRng for deterministic test scenarios.
 */
export interface CombatRng {
  /**
   * Returns a random integer in the closed interval [min, max].
   * Used for damage rolls.
   */
  rollInt(min: number, max: number): number;

  /**
   * Returns true with the given probability in [0, 1].
   * Used for dodge checks and proc-chance evaluation.
   */
  chance(probability: number): boolean;
}
