import { createFeatureSelector, createSelector } from "@ngrx/store";
import { z } from "zod";
import { actionDefinitionSchema } from "@rinner/grayvale-core";
import { ActionState } from "./action.state";

type ActionDefinition = z.infer<typeof actionDefinitionSchema>;

export const selectActionFeature = createFeatureSelector<ActionState>("action");

export const selectAvailableActions = createSelector(
  selectActionFeature,
  (state) => state.available
);

export const selectUnlockedActions = createSelector(
  selectActionFeature,
  (state) => state.unlocked
);

export const selectAvailableActionsForLocation = createSelector(
  selectAvailableActions,
  selectUnlockedActions,
  (available, unlocked) =>
    (available as unknown[]).filter((action: any) => unlocked.has(action.id))
);

export const selectActionLoading = createSelector(
  selectActionFeature,
  (state) => state.loading
);

export const selectActionExecuting = createSelector(
  selectActionFeature,
  (state) => state.executing
);

export const selectActionError = createSelector(
  selectActionFeature,
  (state) => state.error
);

export const selectActionById = (actionId: string) =>
  createSelector(selectAvailableActions, (actions) =>
    (actions as any[]).find((a: any) => a.id === actionId)
  );

export const selectCurrentLocation = createSelector(
  selectActionFeature,
  (state) => state.currentLocation
);
