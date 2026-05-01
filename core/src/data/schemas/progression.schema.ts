import { z } from "zod";

export const experienceProgressionSchema = z
  .object({
    level: z.number(),
    experience: z.number()
  })
  .strict();

export const experienceConfigSchema = z
  .object({
    baseXp: z.number().positive(),
    growthFactor: z.number().positive(),
    exponent: z.number().positive()
  })
  .strict();

export const experienceConfigSetSchema = z.record(z.string(), experienceConfigSchema);
