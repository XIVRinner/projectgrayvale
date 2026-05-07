/** Visual variant applied to the tooltip shell based on item category. */
export type ItemTooltipVariant = "equipment" | "material" | "quest" | "junk";

export type ItemTooltipBaseRarity =
  | "junk"
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "ephemeral"
  | "mythical"
  | "primal";

export type ItemTooltipSpecialRarity =
  | "cursed"
  | "divine"
  | "infernal"
  | "phantom"
  | "temporal"
  | "secret"
  | "galvanized";
