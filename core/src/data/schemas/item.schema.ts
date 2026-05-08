import { z } from "zod";

import { loadoutSlotSchema } from "./loadout.schema";
import { descriptionSchema, idSchema, nameSchema } from "./shared";
import { raritySchema } from "./weapon.schema";

export const itemCategorySchema = z.enum([
  "equipment",
  "material",
  "quest_item",
  "junk"
]);

export const specialRaritySchema = z.enum([
  "legendary",
  "mythical",
  "ephemeral",
  "primal",
  "divine",
  "infernal",
  "cursed"
]);

export const baseInventoryItemSchema = z.object({
  id: idSchema,
  name: nameSchema,
  category: itemCategorySchema,
  rarity: raritySchema,
  specialRarity: specialRaritySchema.optional(),
  iconPath: z.string().min(1).optional(),
  tags: z.array(z.string()),
  description: descriptionSchema.optional(),
  flavor: z.string().optional()
});

export const itemCombatStatSchema = z
  .object({
    stat: z.string().min(1),
    value: z.number(),
    operation: z.enum(["add", "multiply"])
  })
  .strict();

export const equipmentRequirementsSchema = z
  .object({
    levelRequirement: z.number().int().min(1).optional(),
    skillRequirement: z
      .object({
        skillId: idSchema,
        level: z.number().int().min(1)
      })
      .strict()
      .optional()
  })
  .strict();

export const equipmentTooltipDataSchema = z
  .object({
    statLines: z.array(z.string()).optional(),
    effectLines: z.array(z.string()).optional(),
    flavorText: z.string().optional()
  })
  .strict();

export const inventoryEquipmentItemSchema = baseInventoryItemSchema
  .extend({
    category: z.literal("equipment"),
    slot: loadoutSlotSchema,
    itemLevel: z.number().int().min(1),
    requirements: equipmentRequirementsSchema.optional(),
    combatStats: z.array(itemCombatStatSchema).optional(),
    specialEffects: z.array(idSchema).optional(),
    tooltip: equipmentTooltipDataSchema.optional()
  })
  .strict();

export const materialQualitySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);

export const inventoryMaterialItemSchema = baseInventoryItemSchema
  .extend({
    category: z.literal("material"),
    quantity: z.number().int().min(0),
    qualityStars: materialQualitySchema.optional(),
    craftingTags: z.array(z.string()).optional(),
    source: z.string().optional()
  })
  .strict();

export const questItemDesignationSchema = z.enum([
  "temporal",
  "secret",
  "special"
]);

export const inventoryQuestItemSchema = baseInventoryItemSchema
  .extend({
    category: z.literal("quest_item"),
    questContext: z.string().min(1),
    designation: questItemDesignationSchema.optional(),
    usable: z.boolean(),
    locked: z.boolean().optional()
  })
  .strict();

export const inventoryJunkItemSchema = baseInventoryItemSchema
  .extend({
    category: z.literal("junk"),
    sellValue: z.number().min(0).optional()
  })
  .strict();

export const inventoryItemDefinitionSchema = z.discriminatedUnion("category", [
  inventoryEquipmentItemSchema,
  inventoryMaterialItemSchema,
  inventoryQuestItemSchema,
  inventoryJunkItemSchema
]);
