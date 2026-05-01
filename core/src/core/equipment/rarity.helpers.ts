import { RARITY_DEFINITIONS } from "./rarity.definitions";
import type { Rarity, RarityDefinition } from "./rarity.types";

export const getRarityDefinition = (rarity: Rarity): RarityDefinition =>
  RARITY_DEFINITIONS[rarity];