import type {
  EquipmentSlot,
  InventoryItemDefinition,
  ItemCategory,
  MaterialQuality,
  SpecialRarity
} from "@rinner/grayvale-core";

export type InventoryPanelCategory = "all" | ItemCategory;

export interface InventoryPanelItemView {
  readonly id: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly rarity: string;
  readonly specialRarity?: SpecialRarity;
  readonly itemTypeLabel: string;
  readonly quantity: number | null;
  readonly qualityStars: MaterialQuality | null;
  readonly itemLevel: number | null;
  readonly slot: EquipmentSlot | null;
  readonly inspectTooltip: string;
  readonly compareSummary: string | null;
  readonly isEquipped: boolean;
  readonly searchTerms: readonly string[];
}

export interface InventoryEquipEvent {
  readonly slot: EquipmentSlot;
  readonly itemId: string;
}

export const INVENTORY_CATEGORY_ORDER: readonly InventoryPanelCategory[] = [
  "all",
  "equipment",
  "material",
  "quest_item",
  "junk"
];

export const INVENTORY_CATEGORY_LABELS: Readonly<Record<InventoryPanelCategory, string>> = {
  all: "All",
  equipment: "Equipment",
  material: "Materials",
  quest_item: "Quest Items",
  junk: "Junk"
};

export const isEquipmentItem = (
  item: InventoryItemDefinition
): item is Extract<InventoryItemDefinition, { readonly category: "equipment" }> =>
  item.category === "equipment";
