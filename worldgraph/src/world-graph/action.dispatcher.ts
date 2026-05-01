import type { Delta } from "@rinner/grayvale-core";

import type { Action, ActionRegistry } from "./action.types";

export const dispatchActions = (
  actions: Action[],
  context: any,
  registry: ActionRegistry
): Delta[] => {
  const deltas: Delta[] = [];

  for (const action of actions) {
    const handler = registry[action.type];

    if (handler === undefined) {
      console.warn(
        `[WorldGraph] No ActionHandler registered for action type \"${action.type}\".`
      );
      continue;
    }

    deltas.push(...handler(action, context));
  }

  return deltas;
};