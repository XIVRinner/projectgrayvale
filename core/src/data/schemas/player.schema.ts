import { z } from "zod";

import { equippedItemsSchema } from "./equipment.schema";
import { inventorySchema } from "./inventory.schema";
import { experienceProgressionSchema } from "./progression.schema";
import { descriptionSchema, idSchema, nameSchema, stringNumberRecordSchema } from "./shared";

export const playerSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    race: z.string(),
    jobClass: z.string(),
    progression: experienceProgressionSchema,
    adventurerRank: z.number(),
    attributes: stringNumberRecordSchema,
    skills: stringNumberRecordSchema,
    questLog: z
      .object({
        quests: z.record(
          z.string(),
          z
            .object({
              currentStep: z.string(),
              status: z.enum(["inactive", "active", "completed"]),
              completedSteps: z.array(z.string()).optional()
            })
            .strict()
        )
      })
      .strict()
      .optional(),
    inventory: inventorySchema,
    equippedItems: equippedItemsSchema
  })
  .strict();
