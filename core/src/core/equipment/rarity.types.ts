export type Rarity =
  | "trash"
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythical"
  | "ephemeral"
  | "primal"
  | "divine"
  | "infernal"
  | "cursed";

export type RarityDefinition = {
  id: Rarity;
  name: string;
  description: string;
  color: string;
  tier?: number;
  behaviorHint?: string;
};