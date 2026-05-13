import { z } from "zod";

import { definitionTypes } from "../definitions/definition-types";

export const allowedTagTargets = [...definitionTypes, "skills"] as const;

export const tagRegistrySchema = z.object({
  categories: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      description: z.string(),
      allowedFor: z.array(z.enum(allowedTagTargets)).min(1),
      tags: z.array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1),
          description: z.string()
        })
      )
    })
  )
});

export type TagRegistry = z.infer<typeof tagRegistrySchema>;
