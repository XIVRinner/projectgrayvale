import { z } from "zod";

import { descriptionSchema, idSchema, nameSchema } from "./shared";

export const activityDefinitionSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    tags: z.array(z.string()).min(1),
    governingAttributes: z.array(z.string()).min(1),
    difficulty: z.number(),
    itemId: z.string().optional()
  })
  .strict();
