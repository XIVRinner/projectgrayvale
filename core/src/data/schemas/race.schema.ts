import { z } from "zod";

export const modifierSchema = z
  .object({
    stat: z.string(),
    type: z.enum(["add", "multiply"]),
    value: z.number()
  })
  .strict();

export const raceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    adjective: z.string(),
    slug: z.string(),
    imageBasePath: z.string(),
    variants: z
      .object({
        warm: z.array(z.string()).optional(),
        cool: z.array(z.string()).optional(),
        exotic: z.array(z.string()).optional()
      })
      .strict()
      .optional(),
    startingBonuses: z.array(modifierSchema).optional()
  })
  .strict();
