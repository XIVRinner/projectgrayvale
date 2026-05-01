import { z } from "zod";

import { equippedItemsSchema } from "./equipment.schema";
import { inventorySchema } from "./inventory.schema";
import { experienceProgressionSchema } from "./progression.schema";
import { descriptionSchema, idSchema, nameSchema, stringNumberRecordSchema } from "./shared";

export const playerDifficultySchema = z
  .object({
    mode: z.enum(["easy", "normal", "hard"]),
    expert: z.boolean(),
    ironman: z.boolean()
  })
  .strict();

export const playerSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    raceId: z.string(),
    jobClass: z.string(),
    progression: experienceProgressionSchema,
    adventurerRank: z.number(),
    difficulty: playerDifficultySchema
      .optional()
      .default({
        mode: "normal",
        expert: false,
        ironman: false
      }),
    genderId: z.string().optional(),
    attributes: stringNumberRecordSchema,
    skills: stringNumberRecordSchema,
    selectedAppearance: z
      .object({
        variant: z.enum(["warm", "cool", "exotic"]),
        imageIndex: z.number().int()
      })
      .strict()
      .optional(),
    talents: z.array(z.string()).optional(),
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
    story: z
      .object({
        currentArcId: z.string(),
        currentChapter: z.number().int(),
        completedChapters: z.array(z.number().int()).optional()
      })
      .strict()
      .optional(),
    inventory: inventorySchema,
    equippedItems: equippedItemsSchema
  })
  .strict();
