import { createAction, props } from "@ngrx/store";
import { z } from "zod";
import { actionDefinitionSchema } from "@rinner/grayvale-core";

export const loadActions = createAction(
  "[Action Feature] Load Actions",
  props<{ location: string }>()
);

export const loadActionsSuccess = createAction(
  "[Action Feature] Load Actions Success",
  props<{ actions: z.infer<typeof actionDefinitionSchema>[] }>()
);

export const loadActionsFailure = createAction(
  "[Action Feature] Load Actions Failure",
  props<{ error: string }>()
);

export const executeAction = createAction(
  "[Action Feature] Execute Action",
  props<{ actionId: string }>()
);

export const executeActionSuccess = createAction(
  "[Action Feature] Execute Action Success",
  props<{ actionId: string; result: Record<string, unknown> }>()
);

export const executeActionFailure = createAction(
  "[Action Feature] Execute Action Failure",
  props<{ error: string }>()
);

export const unlockAction = createAction(
  "[Action Feature] Unlock Action",
  props<{ actionId: string }>()
);

