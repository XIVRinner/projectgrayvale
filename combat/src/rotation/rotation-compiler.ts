import type {
  EquipmentDefinition,
  SkillDefinition,
  CompiledRotation
} from "@rinner/grayvale-core";

/**
 * Compiles the default short blade rotation from the provided equipment and
 * skill definition.
 *
 * The compiled rotation encodes the standard priority order:
 * 1. Piercing Finisher when 2 `piercing_talon` stacks are available.
 * 2. Slashing Cut (builds piercing_talon stacks).
 * 3. Auto Attack fallback.
 *
 * @param _equipment  The equipped items (reserved for future legendary/modifier
 *                    injection; unused at MVP scope).
 * @param skill       The short blade {@link SkillDefinition}.
 */
export function compileShortBladeRotation(
  _equipment: EquipmentDefinition[],
  skill: SkillDefinition
): CompiledRotation {
  return {
    skillId: skill.id,
    rules: [
      {
        abilityId: "ability_piercing_finisher",
        condition: {
          type: "effect_stacks_gte",
          effectId: "effect_piercing_talon",
          threshold: 2
        }
      },
      {
        abilityId: "ability_slashing_cut"
      },
      {
        abilityId: "ability_auto_attack",
        isFallback: true
      }
    ]
  };
}
