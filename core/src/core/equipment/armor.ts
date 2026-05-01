import type { EquipmentItem } from "./equipment.types";

export type ArmorType = "light" | "medium" | "heavy" | "robe";

export interface Armor extends EquipmentItem {
  type: "armor";
  armorType: ArmorType;
  slot: "head" | "body" | "legs" | "hands";
}
