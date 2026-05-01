import { z } from "zod";

import { equipmentSlotSchema } from "./equipment.schema";
import { descriptionSchema, idSchema, nameSchema } from "./shared";

export const scalingRuleSchema = z
  .object({
    skills: z.array(z.string()).min(1),
    attributes: z.array(z.string()).optional(),
    factors: z
      .object({
        skills: z.number().optional(),
        attributes: z.number().optional()
      })
      .optional()
  })
  .strict();

export const weaponHandednessSchema = z.enum(["oneHanded", "twoHanded"]);

export const raritySchema = z.enum([
  "trash",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
  "ephemeral",
  "primal",
  "divine",
  "infernal",
  "cursed"
]);

export const weaponSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    rarity: raritySchema,
    icon: z.string().min(1).optional(),
    type: z.literal("weapon"),
    handedness: weaponHandednessSchema,
    class: z.string(),
    subclass: z.string(),
    allowedSlots: z.array(equipmentSlotSchema),
    tags: z.array(z.string()).optional(),
    scaling: scalingRuleSchema.optional()
  })
  .strict();
