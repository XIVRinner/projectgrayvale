import { z } from "zod";

export const modifierTypeSchema = z.enum(["add", "multiply"]);

export const modifierCategorySchema = z.enum([
  "equipment",
  "buff",
  "debuff",
  "conditional"
]);

export const statDisplayStateSchema = z.enum([
  "buffed",
  "nerfed",
  "neutral",
  "muted",
  "special"
]);

export const modifierSchema = z
  .object({
    stat: z.string(),
    type: modifierTypeSchema,
    value: z.number()
  })
  .strict();

export const labeledModifierSchema = z
  .object({
    stat: z.string(),
    type: modifierTypeSchema,
    value: z.number(),
    source: z.string(),
    category: modifierCategorySchema,
    active: z.boolean(),
    special: z.boolean().optional()
  })
  .strict();

export const statBreakdownSchema = z
  .object({
    stat: z.string(),
    base: z.number(),
    modifiers: z.array(labeledModifierSchema),
    final: z.number(),
    displayState: statDisplayStateSchema
  })
  .strict();
