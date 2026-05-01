import type { NPC, Player } from "@rinner/grayvale-core";

import type { WorldState } from "./graph.types";

export type Guard = {
  type: string;
  params?: Record<string, unknown>;
};

export type GuardContext = {
  player: Player;
  npcs: Record<string, NPC>;
  world: WorldState;
};

export type GuardResolver = (
  guard: Guard,
  context: GuardContext
) => boolean;
