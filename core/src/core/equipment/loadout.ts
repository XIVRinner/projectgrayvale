import type { EquipmentSlot } from "../combat/combat.equipment";
import type { Loadout, LoadoutSlotComparison, LoadoutSlotMap } from "./loadout.types";

export const createLoadout = (
  id: string,
  displayName: string,
  notes?: string
): Loadout => ({
  id,
  displayName,
  slots: {},
  isActive: false,
  notes
});

export const renameLoadout = (loadout: Loadout, displayName: string): Loadout => ({
  ...loadout,
  displayName
});

/**
 * Sets the target loadout as active and deactivates all others.
 * Returns a new record without mutating the input.
 */
export const selectActiveLoadout = (
  loadouts: Record<string, Loadout>,
  targetId: string
): Record<string, Loadout> => {
  const result: Record<string, Loadout> = {};

  for (const [id, loadout] of Object.entries(loadouts)) {
    result[id] = { ...loadout, isActive: id === targetId };
  }

  return result;
};

/** Assigns an item to a slot in the given loadout. Returns a new loadout. */
export const equipItem = (
  loadout: Loadout,
  slot: EquipmentSlot,
  itemId: string
): Loadout => ({
  ...loadout,
  slots: { ...loadout.slots, [slot]: itemId }
});

/** Removes the item from a slot in the given loadout. Returns a new loadout. */
export const unequipItem = (loadout: Loadout, slot: EquipmentSlot): Loadout => {
  const slots: LoadoutSlotMap = { ...loadout.slots };

  delete slots[slot];

  return { ...loadout, slots };
};

/**
 * Compares a proposed item against the item currently occupying a slot.
 * `isUpgrade` is `undefined` because item stat comparison requires full item
 * definitions which are outside the scope of this pure model layer.
 */
export const compareItemAgainstSlot = (
  loadout: Loadout,
  slot: EquipmentSlot,
  proposedItemId: string
): LoadoutSlotComparison => ({
  slot,
  currentItemId: loadout.slots[slot],
  proposedItemId,
  isUpgrade: undefined
});
