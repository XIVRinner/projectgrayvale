import type { EffectDefinition } from "../../../core/combat";

export const bleedingEffect: EffectDefinition = {
  id: "effect_bleeding",
  displayName: "Bleeding",
  tags: ["debuff", "dot", "bleed"],
  effectType: "dot",
  durationTicks: 4,
  maxStacks: 5,
  sourceSpecific: false,
  tickTiming: "start_of_tick",
  damageOverTime: {
    damageType: "slashing",
    scaling: {
      type: "percent_of_last_piercing_damage",
      value: 0.25
    }
  }
};

export const piercingTalonStack: EffectDefinition = {
  id: "effect_piercing_talon",
  displayName: "Piercing Talon",
  tags: ["debuff", "stack", "armor_shred"],
  effectType: "resource_stack",
  maxStacks: 3,
  sourceSpecific: false,
  modifiers: [
    {
      target: "damage_taken",
      operation: "multiply",
      value: 1.05,
      damageType: "piercing"
    }
  ]
};

export const attackDamageDownEffect: EffectDefinition = {
  id: "effect_attack_damage_down",
  displayName: "Attack Damage Down",
  tags: ["debuff", "damage_reduction"],
  effectType: "debuff",
  durationTicks: 3,
  maxStacks: 1,
  sourceSpecific: false,
  modifiers: [
    {
      target: "damage_done",
      operation: "multiply",
      value: 0.8
    }
  ]
};
