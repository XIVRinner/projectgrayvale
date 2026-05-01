import type { Player } from "../models";
import type { Weapon } from "./weapon";
import {
  EQUIPMENT_SLOTS,
  type EquippableItem,
  type SupportedEquipmentSlot
} from "./equip.types";

const isSupportedSlot = (slot: string): slot is SupportedEquipmentSlot =>
  EQUIPMENT_SLOTS.includes(slot as SupportedEquipmentSlot);

const isWeapon = (item: EquippableItem): item is Weapon => item.type === "weapon";

export const isTwoHanded = (item: EquippableItem): boolean =>
  isWeapon(item) && item.handedness === "twoHanded";

export const canEquip = (
  player: Player,
  item: EquippableItem,
  slot: SupportedEquipmentSlot
): boolean => {
  void player;

  if (!isSupportedSlot(slot)) {
    return false;
  }

  if (slot === "offHand" && isTwoHanded(item)) {
    return false;
  }

  if (!item.allowedSlots.includes(slot)) {
    return false;
  }

  return true;
};

export const equip = (
  player: Player,
  item: EquippableItem,
  slot: SupportedEquipmentSlot
): Player => {
  if (!isSupportedSlot(slot)) {
    throw new Error(`Cannot equip item "${item.id}" to unsupported slot "${slot}".`);
  }

  if (slot === "offHand" && isTwoHanded(item)) {
    throw new Error(`Cannot equip two-handed item "${item.id}" to offHand.`);
  }

  if (!item.allowedSlots.includes(slot)) {
    throw new Error(`Cannot equip item "${item.id}" to slot "${slot}": slot is not allowed.`);
  }

  const equippedItems =
    slot === "mainHand" && isTwoHanded(item)
      ? {
          ...player.equippedItems,
          mainHand: item.id,
          offHand: undefined
        }
      : {
          ...player.equippedItems,
          [slot]: item.id
        };

  return {
    ...player,
    equippedItems
  };
};

export const unequip = (
  player: Player,
  slot: SupportedEquipmentSlot
): Player => {
  if (!isSupportedSlot(slot)) {
    return {
      ...player,
      equippedItems: { ...player.equippedItems }
    };
  }

  return {
    ...player,
    equippedItems: {
      ...player.equippedItems,
      [slot]: undefined
    }
  };
};
