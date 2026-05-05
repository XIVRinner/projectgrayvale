import type { SkillDefinition } from "../../../core/combat";

export const shortBladeSkill: SkillDefinition = {
  id: "skill_short_blade",
  displayName: "Short Blade",
  tags: ["combat", "melee", "short_blade"],
  defaultRotationId: "rotation_short_blade_default",
  abilityIds: [
    "ability_basic_thrust",
    "ability_quick_slash",
    "ability_slashing_cut",
    "ability_piercing_finisher",
    "ability_auto_attack"
  ]
};

export const lightArmorSkill: SkillDefinition = {
  id: "skill_light_armor",
  displayName: "Light Armor",
  tags: ["combat", "defense", "light_armor"],
  abilityIds: []
};
