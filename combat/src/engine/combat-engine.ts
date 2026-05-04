import type { DamagePacket, EffectApplicationDefinition } from "@rinner/grayvale-core";
import type { CombatRng } from "../rng/combat-rng";
import { DefaultCombatRng } from "../rng/default-combat-rng";

/**
 * Core resolution engine for a single combat encounter.
 *
 * The engine accepts an injected {@link CombatRng} so that tests can
 * substitute a {@link TestCombatRng} for fully deterministic results.
 */
export class CombatEngine {
  private readonly rng: CombatRng;

  constructor(rng: CombatRng = new DefaultCombatRng()) {
    this.rng = rng;
  }

  /**
   * Rolls damage for one {@link DamagePacket}.
   * Returns an integer in [packet.interval.min, packet.interval.max].
   */
  rollDamage(packet: DamagePacket): number {
    return this.rng.rollInt(packet.interval.min, packet.interval.max);
  }

  /**
   * Evaluates a dodge check.
   * @param dodgeChance Probability in [0, 1].
   * @returns true when the attack is dodged.
   */
  checkDodge(dodgeChance: number): boolean {
    return this.rng.chance(dodgeChance);
  }

  /**
   * Evaluates whether a status effect is applied.
   * @param application The effect application definition containing the proc chance.
   * @returns true when the effect should be applied.
   */
  checkEffectApplication(application: EffectApplicationDefinition): boolean {
    const probability = application.chance ?? 1;
    return this.rng.chance(probability);
  }
}
