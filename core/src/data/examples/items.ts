import type {
  InventoryEquipmentItem,
  InventoryItemDefinition,
  InventoryJunkItem,
  InventoryMaterialItem,
  InventoryQuestItem
} from "../../core/inventory/inventory-item.types";

export const sampleEquipmentItem: InventoryEquipmentItem = {
  id: "item_sword_iron",
  name: "Iron Sword",
  category: "equipment",
  rarity: "common",
  tags: ["sword", "melee"],
  slot: "main_hand",
  itemLevel: 5,
  description: "A reliable iron sword favoured by militia recruits.",
  requirements: { levelRequirement: 3 },
  damage: {
    slashing: { min: 6, max: 10 }
  },
  combatStats: [{ stat: "physical_damage", value: 12, operation: "add" }],
  tooltip: {
    statLines: ["+12 Physical Damage"],
    flavorText: "Forged in Graymark. Many recruits' first blade."
  }
};

export const sampleMaterialItem: InventoryMaterialItem = {
  id: "mat_ironore_common",
  name: "Iron Ore",
  category: "material",
  rarity: "common",
  tags: ["ore", "metal"],
  quantity: 10,
  qualityStars: 2,
  craftingTags: ["smithing"],
  source: "Graymark Mines"
};

export const sampleLegendaryMaterial: InventoryMaterialItem = {
  id: "mat_ashcore_fragment",
  name: "Ashcore Fragment",
  category: "material",
  rarity: "legendary",
  specialRarity: "legendary",
  tags: ["fragment", "infernal", "rare-drop"],
  quantity: 1,
  craftingTags: ["infernal-smithing", "relic-crafting"],
  source: "Ashen Vault"
};

export const sampleQuestItem: InventoryQuestItem = {
  id: "quest_item_signal_stone",
  name: "Signal Stone",
  category: "quest_item",
  rarity: "uncommon",
  tags: ["quest", "signal"],
  questContext: "quest_the_silent_road",
  usable: true,
  designation: "temporal",
  description: "A stone that resonates when held near the old waymarkers."
};

export const sampleJunkItem: InventoryJunkItem = {
  id: "junk_bent_spoon",
  name: "Bent Spoon",
  category: "junk",
  rarity: "trash",
  tags: ["junk", "metal"],
  sellValue: 1,
  flavor: "Someone ate here. Enthusiastically."
};

export const sampleInventoryItems: InventoryItemDefinition[] = [
  sampleEquipmentItem,
  sampleMaterialItem,
  sampleLegendaryMaterial,
  sampleQuestItem,
  sampleJunkItem
];
