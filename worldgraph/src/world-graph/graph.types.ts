import type { Guard } from "./guard.types";

export type Location = {
  id: string;
  sublocations?: string[];
  guards?: Guard[];
};

export type Edge = {
  from: string;
  to: string;
  guards?: Guard[];
};

export type WorldGraph = {
  locations: Record<string, Location>;
  edges: Edge[];
};

export type WorldState = {
  currentLocation: string;
  sublocations: string[];
};
