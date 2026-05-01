import { z } from "zod";

import { idSchema } from "./shared";

export const equipmentSlotSchema = z.enum([
  "mainHand",
  "offHand",
  "head",
  "body",
  "legs",
  "hands"
]);

export const equippedItemsSchema = z
  .object({
    mainHand: idSchema.optional(),
    offHand: idSchema.optional(),
    head: idSchema.optional(),
    body: idSchema.optional(),
    legs: idSchema.optional(),
    hands: idSchema.optional()
  })
  .strict();
