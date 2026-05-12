import { z } from "zod";
import { actionDefinitionSchema } from "@rinner/grayvale-core";

export interface ActionState {
  available: z.infer<typeof actionDefinitionSchema>[];
  unlocked: Set<string>;
  loading: boolean;
  executing: boolean;
  error: string | null;
  currentLocation: string | null;
}

export const initialActionState: ActionState = {
  available: [],
  unlocked: new Set(),
  loading: false,
  executing: false,
  error: null,
  currentLocation: null
};
