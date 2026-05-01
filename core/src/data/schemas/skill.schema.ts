import { z } from "zod";

import { descriptionSchema, idSchema, nameSchema } from "./shared";

export const skillSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    tags: z.array(z.string()).min(1),
    experience: z.number().optional(),
    maxLevel: z.number().optional()
  })
  .strict();
