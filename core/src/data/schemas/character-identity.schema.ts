import { z } from "zod";

import { inventorySchema } from "./inventory.schema";
import { idSchema } from "./shared";

export const characterIdentitySchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    raceId: z.string().min(1),
    genderId: z.string().optional(),
    level: z.number().int().min(1),
    classId: z.string().optional(),
    adventurerRank: z.number().int().min(1).optional(),
    tags: z.array(z.string()),
    activeLoadoutId: z.string().min(1),
    inventory: inventorySchema
  })
  .strict();
