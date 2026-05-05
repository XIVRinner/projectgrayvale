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

export const slashingCut: AbilityDefinition = {
  id: "ability_slashing_cut",
  displayName: "Slashing Cut",
  tags: ["attack", "melee", "short_blade", "slashing"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [
    {
      damageType: "slashing",
      interval: { min: 2, max: 5 }
    }
  ],
  appliesEffects: [
    {
      effectId: "effect_piercing_talon",
      stacks: 1,
      target: "self"
    }
  ]
};

export const piercingFinisher: AbilityDefinition = {
  id: "ability_piercing_finisher",
  displayName: "Piercing Finisher",
  tags: ["attack", "melee", "short_blade", "piercing", "finisher"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [
    {
      damageType: "piercing",
      interval: { min: 5, max: 12 }
    }
  ],
  spendsEffects: [
    {
      effectId: "effect_piercing_talon",
      stacks: 2,
      target: "self"
    }
  ]
};

export const autoAttack: AbilityDefinition = {
  id: "ability_auto_attack",
  displayName: "Auto Attack",
  tags: ["attack", "melee", "auto"],
  abilityType: "attack",
  targetRule: "main_target",
  consumesAction: true,
  cooldownTicks: 0,
  damagePackets: [
    {
      damageType: "slashing",
      interval: { min: 1, max: 3 }
    }
  ]
};

export const instantPierce: AbilityDefinition = {
  id: "ability_instant_pierce",
  displayName: "Instant Pierce",
  tags: ["attack", "melee", "short_blade", "piercing", "reaction"],
  abilityType: "reaction",
  targetRule: "main_target",
  consumesAction: false,
  isReaction: true,
  cooldownTicks: 2,
  damagePackets: [
    {
      damageType: "piercing",
      interval: { min: 5, max: 10 }
    }
  ],
  appliesEffects: [
    {
      effectId: "effect_bleeding",
      chance: 0.5,
      stacks: 1,
      target: "main_target"
    },
    {
      effectId: "effect_attack_damage_down",
      stacks: 1,
      target: "main_target"
    }
  ]
};
