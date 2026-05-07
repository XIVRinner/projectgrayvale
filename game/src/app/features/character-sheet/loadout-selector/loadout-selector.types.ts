import type { EquipmentSlot, InventoryEquipmentItem } from "@rinner/grayvale-core";

/** View model for a single loadout row in the selector list. */
export interface LoadoutRowView {
  readonly id: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly notes?: string;
}

/** View model for a single equipment slot within the active loadout detail. */
export interface LoadoutSlotRowView {
  readonly slotId: EquipmentSlot;
  readonly slotLabel: string;
  readonly equippedItem: InventoryEquipmentItem | null;
}

/** Rename event emitted by a loadout row. */
export interface LoadoutRenameEvent {
  readonly id: string;
  readonly displayName: string;
}

/** Equip event emitted when an item is assigned to a slot. */
export interface LoadoutEquipEvent {
  readonly slot: EquipmentSlot;
  readonly itemId: string;
}
