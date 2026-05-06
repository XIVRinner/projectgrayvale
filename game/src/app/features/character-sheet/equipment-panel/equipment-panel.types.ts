import type { EquipmentSlot, InventoryEquipmentItem } from "@rinner/grayvale-core";

/** View model for a single equipment slot rendered in the panel. */
export interface EquipmentSlotView {
  readonly slotId: EquipmentSlot;
  readonly slotLabel: string;
  /** Null when the slot is empty. */
  readonly item: InventoryEquipmentItem | null;
  /** True when this slot is the active comparison target (item hovered in inventory). */
  readonly isCompareTarget: boolean;
}

/** Full view state for the equipment panel. */
export interface EquipmentPanelViewState {
  readonly slots: readonly EquipmentSlotView[];
  readonly isLoading: boolean;
  readonly error: string | null;
}
