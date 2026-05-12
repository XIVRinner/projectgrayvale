import { z } from "zod";

import { descriptionSchema, idSchema, nameSchema } from "./shared";

export const actionCostFactorSchema = z
  .object({
    source: z.union([
      z.literal("player_level"),
      z.literal("hp_missing"),
      z.literal("hp_max"),
      z.literal("base")
    ]),
    multiplier: z.number().finite()
  })
  .strict();

export const actionCostSchema = z
  .object({
    type: z.literal("calculated"),
    base: z.number().finite(),
    factors: z.array(actionCostFactorSchema).optional()
  })
  .strict();

export const actionEffectSchema = z
  .object({
    type: z.union([
      z.literal("heal_full"),
      z.literal("heal_partial"),
      z.literal("restore_resource")
    ]),
    meta: z.record(z.unknown()).optional()
  })
  .strict();

export const actionDefinitionSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    tags: z.array(z.string()).min(1),
    cost: actionCostSchema,
    effect: actionEffectSchema,
    requirements: z
      .object({
        minLevel: z.number().optional(),
        location: z.string().optional()
      })
      .strict()
      .optional()
  })
  .strict();
