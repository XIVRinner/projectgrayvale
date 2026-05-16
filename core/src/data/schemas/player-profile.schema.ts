import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);

export const characterContentBindingSchema = z
  .object({
    serverName: nonEmptyStringSchema,
    customContent: z.boolean(),
    profileToken: nonEmptyStringSchema,
    acceptedAt: nonEmptyStringSchema,
  })
  .strict();

const playerCharacterSummaryBaseSchema = z
  .object({
    id: nonEmptyStringSchema,
    profileId: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    portraitShardId: nonEmptyStringSchema.optional(),
    level: z.number().int().min(1).optional(),
    locationId: nonEmptyStringSchema.optional(),
    lastLocationName: nonEmptyStringSchema.optional(),
    online: z.boolean().optional(),
    lastPlayedAt: nonEmptyStringSchema.optional(),
    contentBinding: characterContentBindingSchema.optional(),
    guildId: nonEmptyStringSchema.optional(),
    guildName: nonEmptyStringSchema.optional(),
  })
  .strict();

export const playerCharacterSummarySchema = playerCharacterSummaryBaseSchema
  .superRefine((value, context) => {
    if (value.id === value.profileId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Profile ID and Character ID must be different.",
        path: ["id"],
      });
    }
  });

export const playerCharacterSchema = playerCharacterSummaryBaseSchema.extend({
  createdAt: nonEmptyStringSchema,
  updatedAt: nonEmptyStringSchema,
}).superRefine((value, context) => {
  if (value.id === value.profileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Profile ID and Character ID must be different.",
      path: ["id"],
    });
  }
});

export const playerProfileSchema = z
  .object({
    id: nonEmptyStringSchema,
    displayName: nonEmptyStringSchema.optional(),
    createdAt: nonEmptyStringSchema,
    updatedAt: nonEmptyStringSchema,
    characters: z.array(playerCharacterSummarySchema),
  })
  .strict();

export const playerSessionSchema = z
  .object({
    profileId: nonEmptyStringSchema,
    activeCharacterId: nonEmptyStringSchema.optional(),
    authenticatedAt: nonEmptyStringSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.activeCharacterId && value.profileId === value.activeCharacterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Profile ID and Character ID must be different.",
        path: ["activeCharacterId"],
      });
    }
  });
