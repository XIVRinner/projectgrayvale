import type { EquipmentDefinition } from "../../../core/combat";

export const oldDagger: EquipmentDefinition = {
  id: "item_old_dagger",
  displayName: "Old Dagger",
  itemType: "equipment",
  slot: "main_hand",
  itemLevel: 1,
  levelRequirement: 1,
  skillRequirement: {
    skillId: "skill_short_blade",
    level: 1
  },
  associatedSkill: "skill_short_blade",
  tags: ["weapon", "blade", "dagger", "starter"],
  damage: {
    piercing: { min: 3, max: 7 },
    slashing: { min: 2, max: 5 }
  }
};

export const leatherChestpiece: EquipmentDefinition = {
  id: "item_leather_chest",
  displayName: "Leather Chestpiece",
  itemType: "equipment",
  slot: "chest",
  itemLevel: 1,
  levelRequirement: 1,
  armorSkill: "skill_light_armor",
  armorSlotWeight: 0.35,
  tags: ["armor", "light_armor", "leather", "chest"]
};
