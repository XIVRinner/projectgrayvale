import {
  sampleEquipmentItem,
  sampleMaterialItem,
  sampleQuestItem
} from "@rinner/grayvale-core";
import { buildCategoryCounts, filterInventoryItems, toQualityStars } from "./inventory-panel.utils";
import type { InventoryPanelItemView } from "./inventory-panel.types";

const SAMPLE_ITEMS: readonly InventoryPanelItemView[] = [
  {
    id: "weapon_dagger_rustleaf",
    name: "Rustleaf Dagger",
    category: "equipment",
    rarity: "uncommon",
    itemTypeLabel: "Equipment · main hand",
    quantity: null,
    qualityStars: null,
    itemLevel: 8,
    slot: "main_hand",
    inspectTooltip: "Rustleaf Dagger",
    compareSummary: "Slot empty",
    isEquipped: false,
    canEquip: true,
    equipDisabledReason: null,
    searchTerms: ["rustleaf dagger", "equipment", "uncommon"],
    itemDef: sampleEquipmentItem
  },
  {
    id: "mat_ironore_common",
    name: "Iron Ore",
    category: "material",
    rarity: "common",
    itemTypeLabel: "Material",
    quantity: 10,
    qualityStars: 2,
    itemLevel: null,
    slot: null,
    inspectTooltip: "Iron Ore",
    compareSummary: null,
    isEquipped: false,
    canEquip: false,
    equipDisabledReason: null,
    searchTerms: ["iron ore", "material", "common"],
    itemDef: sampleMaterialItem
  },
  {
    id: "quest_item_signal_stone",
    name: "Signal Stone",
    category: "quest_item",
    rarity: "uncommon",
    itemTypeLabel: "Quest Item",
    quantity: null,
    qualityStars: null,
    itemLevel: null,
    slot: null,
    inspectTooltip: "Signal Stone",
    compareSummary: null,
    isEquipped: false,
    canEquip: false,
    equipDisabledReason: null,
    searchTerms: ["signal stone", "quest_item", "uncommon"],
    itemDef: sampleQuestItem
  }
];

describe("inventory-panel utils", () => {
  it("builds category counts including all", () => {
    expect(buildCategoryCounts(SAMPLE_ITEMS)).toEqual({
      all: 3,
      equipment: 1,
      material: 1,
      quest_item: 1,
      junk: 0
    });
  });

  it("filters by category and search term", () => {
    expect(filterInventoryItems(SAMPLE_ITEMS, "material", "iron")).toEqual([SAMPLE_ITEMS[1]]);
    expect(filterInventoryItems(SAMPLE_ITEMS, "equipment", "stone")).toEqual([]);
  });

  it("renders quality stars", () => {
    expect(toQualityStars(4)).toBe("★★★★");
    expect(toQualityStars(null)).toBe("");
  });
});
