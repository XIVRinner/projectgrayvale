import type { Action } from "./action.types";
import type { Guard } from "./guard.types";

export type ActionRule = {
  guards?: Guard[];
  actions: Action[];
};

export type Location = {
  id: string;
  sublocations?: string[];
  guards?: Guard[];
  rules?: ActionRule[];
};

export type Edge = {
  from: string;
  to: string;
  guards?: Guard[];
  rules?: ActionRule[];
};

export type WorldGraph = {
  locations: Record<string, Location>;
  edges: Edge[];
};

export type WorldState = {
  currentLocation: string;
  sublocations: string[];
};
