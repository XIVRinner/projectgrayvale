import type {
  EquipmentSlot,
  InventoryItemDefinition,
  ItemCategory,
  MaterialQuality,
  SpecialRarity
} from "@rinner/grayvale-core";
import type { EquipmentRequirementStatus } from "../character-sheet-equipment-requirements";

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
  readonly canEquip: boolean;
  readonly equipDisabledReason: string | null;
  readonly requirementStatuses: readonly EquipmentRequirementStatus[];
  readonly searchTerms: readonly string[];
  /** Full item definition passed through for rich tooltip rendering. */
  readonly itemDef: InventoryItemDefinition;
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

export const INVENTORY_CATEGORY_ICONS: Readonly<Record<InventoryPanelCategory, string>> = {
  all: "pi pi-th-large",
  equipment: "pi pi-shield",
  material: "pi pi-box",
  quest_item: "pi pi-bookmark",
  junk: "pi pi-trash"
};

export const isEquipmentItem = (
  item: InventoryItemDefinition
): item is Extract<InventoryItemDefinition, { readonly category: "equipment" }> =>
  item.category === "equipment";
