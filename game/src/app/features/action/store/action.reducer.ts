import { createReducer, on } from "@ngrx/store";
import * as ActionActions from "./action.actions";
import { ActionState, initialActionState } from "./action.state";

export const actionReducer = createReducer(
  initialActionState,
  on(ActionActions.loadActions, (state, { location }) => ({
    ...state,
    loading: true,
    error: null,
    currentLocation: location
  })),
  on(ActionActions.loadActionsSuccess, (state, { actions }) => ({
    ...state,
    available: actions,
    loading: false
  })),
  on(ActionActions.loadActionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  on(ActionActions.executeAction, (state) => ({
    ...state,
    executing: true,
    error: null
  })),
  on(ActionActions.executeActionSuccess, (state) => ({
    ...state,
    executing: false
  })),
  on(ActionActions.executeActionFailure, (state, { error }) => ({
    ...state,
    executing: false,
    error
  })),
  on(ActionActions.unlockAction, (state, { actionId }) => ({
    ...state,
    unlocked: new Set([...state.unlocked, actionId])
  }))
);
