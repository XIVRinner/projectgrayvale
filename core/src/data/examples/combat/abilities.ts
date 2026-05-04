import type { AbilityDefinition } from "../../../core/combat";

export const basicThrust: AbilityDefinition = {
  id: "ability_basic_thrust",
  displayName: "Basic Thrust",
  tags: ["attack", "melee", "short_blade", "piercing"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [
    {
      damageType: "piercing",
      interval: { min: 4, max: 9 }
    }
  ]
};

export const quickSlash: AbilityDefinition = {
  id: "ability_quick_slash",
  displayName: "Quick Slash",
  tags: ["attack", "melee", "short_blade", "slashing"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 2,
  damagePackets: [
    {
      damageType: "slashing",
      interval: { min: 3, max: 7 }
    }
  ]
};

export const coyoteScratch: AbilityDefinition = {
  id: "ability_coyote_scratch",
  displayName: "Scratch",
  tags: ["attack", "melee", "beast", "bleed"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 4,
  damagePackets: [
    {
      damageType: "slashing",
      interval: { min: 2, max: 6 }
    }
  ],
  appliesEffects: [
    {
      effectId: "effect_bleeding",
      chance: 0.6,
      stacks: 1,
      target: "main_target"
    }
  ]
};
