import type { Id } from "../models/base";
import type { EquipmentSlot } from "../combat/combat.equipment";
import type { DamageInterval, DamageType } from "../combat/combat.damage";
import type { EffectId } from "../combat/combat.ids";
import type { Rarity } from "../equipment/rarity.types";

/** Logical category that groups an item in the inventory panel. */
export type ItemCategory = "equipment" | "material" | "quest_item" | "junk";

/**
 * Subset of rarities that carry special named behaviour (lore hooks, narrative
 * milestones, or mechanic bends). Materials at these tiers do not use quality
 * stars; other category-specific rules may also apply.
 */
export type SpecialRarity =
  | "legendary"
  | "mythical"
  | "ephemeral"
  | "primal"
  | "divine"
  | "infernal"
  | "cursed";

/** Fields shared by every inventory item definition. */
export interface BaseInventoryItem {
  id: Id;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  /** Present only when the item belongs to a special-rarity tier. */
  specialRarity?: SpecialRarity;
  /** Asset-served thumbnail used by inventory and equipment UIs. */
  iconPath?: string;
  tags: string[];
  description?: string;
  flavor?: string;
}

/** A single combat stat modifier carried by an equipment item. */
export interface ItemCombatStat {
  stat: string;
  value: number;
  operation: "add" | "multiply";
}

/** Level or skill prerequisites that must be met to equip an item. */
export interface EquipmentRequirements {
  levelRequirement?: number;
  skillRequirement?: {
    skillId: string;
    level: number;
  };
}

/** Structured data used to render the equipment inspect tooltip. */
export interface EquipmentTooltipData {
  statLines?: string[];
  effectLines?: string[];
  flavorText?: string;
}

/** An equippable item definition. */
export interface InventoryEquipmentItem extends BaseInventoryItem {
  category: "equipment";
  slot: EquipmentSlot;
  itemLevel: number;
  requirements?: EquipmentRequirements;
  damage?: Partial<Record<DamageType, DamageInterval>>;
  combatStats?: ItemCombatStat[];
  specialEffects?: EffectId[];
  tooltip?: EquipmentTooltipData;
}

/**
 * Quality star rating for crafting materials on a 1–5 scale.
 * Not applicable to items that have a SpecialRarity.
 */
export type MaterialQuality = 1 | 2 | 3 | 4 | 5;

/** A crafting or consumable material. */
export interface InventoryMaterialItem extends BaseInventoryItem {
  category: "material";
  quantity: number;
  /** Only present for non-special-rarity materials. */
  qualityStars?: MaterialQuality;
  craftingTags?: string[];
  source?: string;
}

/** Flags that describe the temporal or narrative nature of a quest item. */
export type QuestItemDesignation = "temporal" | "secret" | "special";

/** A quest-related item that may be usable or locked. */
export interface InventoryQuestItem extends BaseInventoryItem {
  category: "quest_item";
  /** Identifies the quest or use context this item belongs to. */
  questContext: string;
  designation?: QuestItemDesignation;
  usable: boolean;
  locked?: boolean;
}

/** A low-value or miscellaneous item, primarily useful for selling. */
export interface InventoryJunkItem extends BaseInventoryItem {
  category: "junk";
  /** Known sell value in currency units, if established. */
  sellValue?: number;
}

/** Discriminated union of all inventory item definition types. */
export type InventoryItemDefinition =
  | InventoryEquipmentItem
  | InventoryMaterialItem
  | InventoryQuestItem
  | InventoryJunkItem;
