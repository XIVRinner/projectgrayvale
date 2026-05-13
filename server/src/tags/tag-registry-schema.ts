import { z } from "zod";

export const allowedTagTargets = [
  "items",
  "materials",
  "locations",
  "sublocations",
  "activities",
  "actions",
] as const;
export type AllowedTagTarget = (typeof allowedTagTargets)[number];

export const tagRegistrySchema = z.object({
  categories: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      description: z.string().optional().default(""),
      allowedFor: z.array(z.enum(allowedTagTargets)).min(1),
      tags: z.array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1),
          description: z.string().optional().default(""),
        }),
      ).min(1),
    }),
  ),
});

export type TagRegistry = z.infer<typeof tagRegistrySchema>;
