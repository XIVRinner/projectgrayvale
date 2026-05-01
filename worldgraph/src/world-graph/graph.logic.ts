import { evaluateGuards } from "./guard.logic";
import type { GuardContext, GuardResolver } from "./guard.types";
import type { WorldGraph, WorldState } from "./graph.types";

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
