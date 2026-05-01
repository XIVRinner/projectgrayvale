import type { Player } from "../models";
import type { NPC } from "../npc";

export type GameState = {
  player: Player;
  npcs: Record<string, NPC>;
};
