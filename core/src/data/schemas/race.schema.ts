import { z } from "zod";

import { modifierSchema } from "./modifier.schema";

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
    startingBonuses: z.array(modifierSchema).optional(),
    tags: z.array(z.string()).optional()
  })
  .strict();
