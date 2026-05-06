import { z } from "zod";

import { idSchema } from "./shared";

// These values must stay in sync with the EquipmentSlot type defined in
// core/src/core/combat/combat.equipment.ts, which is the canonical definition.
export const loadoutSlotSchema = z.enum([
  "head",
  "chest",
  "gloves",
  "legs",
  "boots",
  "main_hand",
  "off_hand",
  "ring"
]);

export const loadoutSlotMapSchema = z
  .object({
    head: idSchema.optional(),
    chest: idSchema.optional(),
    gloves: idSchema.optional(),
    legs: idSchema.optional(),
    boots: idSchema.optional(),
    main_hand: idSchema.optional(),
    off_hand: idSchema.optional(),
    ring: idSchema.optional()
  })
  .strict();

export const loadoutSchema = z
  .object({
    id: idSchema,
    displayName: z.string().min(1),
    slots: loadoutSlotMapSchema,
    isActive: z.boolean(),
    notes: z.string().optional()
  })
  .strict();

export const loadoutsRecordSchema = z.record(idSchema, loadoutSchema);
