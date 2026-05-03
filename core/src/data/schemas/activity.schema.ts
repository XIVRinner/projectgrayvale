import { z } from "zod";

import { descriptionSchema, idSchema, nameSchema } from "./shared";

export const rewardScalingSchema = z
  .object({
    source: z.union([z.literal("skill"), z.literal("attribute")]),
    id: z.string().min(1),
    factor: z.number().finite()
  })
  .strict();

export const rewardValueSchema = z.union([
  z
    .object({
      type: z.literal("flat"),
      amount: z.number().finite()
    })
    .strict(),
  z
    .object({
      type: z.literal("range"),
      min: z.number().finite(),
      max: z.number().finite()
    })
    .strict()
    .refine((value) => value.min <= value.max, {
      message: "Range reward min cannot be greater than max."
    }),
  z
    .object({
      type: z.literal("scaled"),
      base: z.number().finite(),
      scaling: rewardScalingSchema
    })
    .strict()
]);

export const rewardDistributionSchema = z.union([
  z
    .object({
      type: z.literal("deterministic")
    })
    .strict(),
  z
    .object({
      type: z.literal("random"),
      chance: z.number().min(0).max(1).optional()
    })
    .strict()
]);

export const activityRewardSchema = z
  .object({
    type: z.union([
      z.literal("item"),
      z.literal("currency"),
      z.literal("attribute"),
      z.literal("skill")
    ]),
    targetId: z.string().min(1).optional(),
    value: rewardValueSchema,
    distribution: rewardDistributionSchema.optional()
  })
  .strict();

export const activityDefinitionSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    tags: z.array(z.string()).min(1),
    governingAttributes: z.array(z.string()).min(1),
    difficulty: z.number(),
    itemId: z.string().optional(),
    rewards: z.array(activityRewardSchema).optional()
  })
  .strict();
