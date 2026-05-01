import type { EquipmentItem } from "./equipment.types";

export type WeaponHandedness = "oneHanded" | "twoHanded";

export interface Weapon extends EquipmentItem {
  type: "weapon";
  handedness: WeaponHandedness;
  class: string;
  subclass: string;
}
