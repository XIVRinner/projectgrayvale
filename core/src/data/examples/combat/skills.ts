import type { SkillDefinition } from "../../../core/combat";

export const shortBladeSkill: SkillDefinition = {
  id: "skill_short_blade",
  displayName: "Short Blade",
  tags: ["combat", "melee", "short_blade"],
  defaultRotationId: "rotation_short_blade_default",
  abilityIds: ["ability_basic_thrust", "ability_quick_slash"]
};
