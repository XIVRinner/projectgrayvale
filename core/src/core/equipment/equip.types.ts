import type { Armor } from "./armor";
import { type EquipmentSlot } from "./equipment.types";
import type { Weapon } from "./weapon";

export const EQUIPMENT_SLOTS = [
  "mainHand",
  "offHand",
  "head",
  "body",
  "legs",
  "hands"
] as const;

export type SupportedEquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export type EquippableItem = Weapon | Armor;

export type SlottedEquipmentItem = EquippableItem & {
  allowedSlots: EquipmentSlot[];
};
