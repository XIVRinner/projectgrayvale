import type { Delta } from "@rinner/grayvale-core";

export type Action = {
  type: string;
  params?: Record<string, unknown>;
};

export type ActionHandler = (
  action: Action,
  context: any
) => Delta[];

export type ActionRegistry = Record<string, ActionHandler>;