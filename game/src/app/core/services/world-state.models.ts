export interface SaveSlotWorldState {
  readonly currentLocation: string;
  readonly sublocations: string[];
}

export const DEFAULT_SAVE_SLOT_WORLD_STATE: SaveSlotWorldState = {
  currentLocation: "village-arkama",
  sublocations: ["chief-house"]
};

export function cloneSaveSlotWorldState(
  value: SaveSlotWorldState = DEFAULT_SAVE_SLOT_WORLD_STATE
): SaveSlotWorldState {
  return {
    currentLocation: value.currentLocation,
    sublocations: [...value.sublocations]
  };
}
