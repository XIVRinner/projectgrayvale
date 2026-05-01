import type { Delta } from "@rinner/grayvale-core";

import { dispatchActions } from "./action.dispatcher";
import type { Action, ActionRegistry } from "./action.types";
import { evaluateGuards } from "./guard.logic";
import type { GuardContext, GuardResolver } from "./guard.types";
import type { ActionRule, WorldGraph, WorldState } from "./graph.types";

export const canMove = (
  graph: WorldGraph,
  from: string,
  to: string,
  context?: GuardContext,
  resolver?: GuardResolver
): boolean => {
  const edge = graph.edges.find((candidate) => candidate.from === from && candidate.to === to);

  if (edge === undefined) {
    return false;
  }

  const location = graph.locations[to];

  if (edge.guards === undefined && location?.guards === undefined) {
    return true;
  }

  if (context === undefined || resolver === undefined) {
    return false;
  }

  return (
    evaluateGuards(edge.guards, context, resolver) &&
    evaluateGuards(location?.guards, context, resolver)
  );
};

export const move = (state: WorldState, to: string): WorldState => ({
  ...state,
  currentLocation: to,
  sublocations: []
});

export const hasSublocation = (
  graph: WorldGraph,
  locationId: string,
  subId: string
): boolean => {
  const location = graph.locations[locationId];

  return location?.sublocations?.includes(subId) ?? false;
};

export const evaluateActionRules = (
  rules: ActionRule[] | undefined,
  context: GuardContext,
  resolver: GuardResolver
): Action[] => {
  if (rules === undefined || rules.length === 0) {
    return [];
  }

  const actions: Action[] = [];

  for (const rule of rules) {
    if (evaluateGuards(rule.guards, context, resolver)) {
      actions.push(...rule.actions);
    }
  }

  return actions;
};

export const collectMoveActions = (
  graph: WorldGraph,
  from: string,
  to: string,
  context: GuardContext,
  resolver: GuardResolver
): Action[] => {
  if (!canMove(graph, from, to, context, resolver)) {
    return [];
  }

  const edge = graph.edges.find(
    (candidate) => candidate.from === from && candidate.to === to
  );

  if (edge === undefined) {
    return [];
  }

  const location = graph.locations[to];

  return [
    ...evaluateActionRules(edge.rules, context, resolver),
    ...evaluateActionRules(location?.rules, context, resolver)
  ];
};

export const resolveMoveDeltas = (
  graph: WorldGraph,
  from: string,
  to: string,
  context: GuardContext,
  resolver: GuardResolver,
  registry: ActionRegistry
): Delta[] => {
  const actions = collectMoveActions(graph, from, to, context, resolver);

  return dispatchActions(actions, context, registry);
};

export const enterSublocation = (
  state: WorldState,
  subId: string
): WorldState => ({
  ...state,
  sublocations: [...state.sublocations, subId]
});

export const leaveSublocation = (state: WorldState): WorldState => {
  if (state.sublocations.length === 0) {
    return state;
  }

  return {
    ...state,
    sublocations: state.sublocations.slice(0, -1)
  };
};
