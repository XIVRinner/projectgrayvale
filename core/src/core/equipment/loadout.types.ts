import type { EquipmentSlot } from "../combat/combat.equipment";

/** Maps each equipment slot to an equipped item ID. Absent slots are empty.
 * Values are unvalidated item ID strings; validation against the item registry
 * occurs at the schema boundary or in a higher service layer. */
export type LoadoutSlotMap = Partial<Record<EquipmentSlot, string>>;

export interface Loadout {
  id: string;
  displayName: string;
  slots: LoadoutSlotMap;
  isActive: boolean;
  notes?: string;

  // GAP: resolver profile
  // Blocked on: design
  // Needs: defined resolver profile reference type
  // Do not implement until: ResolverProfile is defined in @rinner/grayvale-core

  // GAP: rotation profile
  // Blocked on: design
  // Needs: defined rotation profile reference type
  // Do not implement until: RotationProfile is defined in @rinner/grayvale-core

  // GAP: activity restrictions
  // Blocked on: design
  // Needs: schema for which activities this loadout applies to
  // Do not implement until: ActivityRestriction model is defined

  // GAP: galvanized validation
  // Blocked on: design
  // Needs: galvanized item validation rules
  // Do not implement until: galvanized validation spec is finalized

  // GAP: boss-specific warnings
  // Blocked on: design
  // Needs: boss ID registry and warning rule schema
  // Do not implement until: BossWarningRule is defined
}

/** Result of comparing a proposed item against the item currently in a slot. */
export interface LoadoutSlotComparison {
  slot: EquipmentSlot;
  currentItemId: string | undefined;
  proposedItemId: string;
  isUpgrade: boolean | undefined;
}
