import type { CompiledRotation } from "@rinner/grayvale-core";

/**
 * Compiles the default coyote enemy rotation.
 *
 * Priority order:
 * 1. Scratch when it is not on cooldown.
 * 2. Auto Attack as the unconditional fallback.
 */
export function compileCoyoteRotation(): CompiledRotation {
  return {
    skillId: "enemy_coyote",
    rules: [
      {
        abilityId: "ability_coyote_scratch",
        condition: {
          type: "ability_not_on_cooldown",
          abilityId: "ability_coyote_scratch"
        }
      },
      {
        abilityId: "ability_auto_attack",
        isFallback: true
      }
    ]
  };
}
