import type { Loadout } from "../../core/equipment/loadout.types";

export const sampleLoadoutDefault: Loadout = {
  id: "loadout_default",
  displayName: "Default",
  isActive: true,
  slots: {
    main_hand: "weapon_dagger_rustleaf",
    head: "armor_hood_rainwoven",
    chest: "armor_mail_graymark"
  }
};

export const sampleLoadoutUtility: Loadout = {
  id: "loadout_utility",
  displayName: "Utility",
  isActive: false,
  notes: "Swap to this loadout for non-combat gathering activities.",
  slots: {}
};

export const sampleLoadouts: Record<string, Loadout> = {
  loadout_default: sampleLoadoutDefault,
  loadout_utility: sampleLoadoutUtility
};
