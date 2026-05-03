import type { ActivityDefinition } from "@rinner/grayvale-core";

/**
 * Narrows activity availability to a world location and optionally a sublocation.
 * When sublocationId is set, the activity only appears when that sublocation is the
 * innermost active sublocation (i.e. sublocations.at(-1)).
 */
export interface GameActivityLocation {
  readonly locationId: string;
  readonly sublocationId?: string;
}

/**
 * Game-layer extension of the core ActivityDefinition.
 * The `location` field is required at the game layer — every activity must declare
 * where in the world it can be performed.
 */
export interface GameActivityDefinition extends ActivityDefinition {
  readonly location: GameActivityLocation;
}

/**
 * Returns true when the given location rule matches the player's current world state.
 */
export function isActivityAvailableAtWorld(
  location: GameActivityLocation,
  world: { readonly currentLocation: string; readonly sublocations: readonly string[] }
): boolean {
  if (world.currentLocation !== location.locationId) {
    return false;
  }

  if (location.sublocationId !== undefined) {
    return world.sublocations.at(-1) === location.sublocationId;
  }

  return true;
}
