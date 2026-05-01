import { z } from "zod";

import { idSchema } from "./shared";

export const inventorySchema = z
  .object({
    items: z.record(idSchema, z.number())
  })
  .strict();
