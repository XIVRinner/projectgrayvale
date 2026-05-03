import type { Delta, ItemObjective } from "@rinner/grayvale-core";

import type { ObjectiveProgress } from "../quest-tracker";

export function matchesItemDelta(delta: Delta, objective: ItemObjective): boolean {
  return (
    delta.target === "player" &&
    delta.path.length === 3 &&
    delta.path[0] === "inventory" &&
    delta.path[1] === "items" &&
    delta.path[2] === objective.itemId &&
    typeof delta.value === "number"
  );
}

export function applyItemObjectiveDelta(
  objective: ItemObjective,
  progress: ObjectiveProgress,
  delta: Delta
): ObjectiveProgress | null {
  if (!matchesItemDelta(delta, objective) || typeof delta.value !== "number") {
    return null;
  }

  const current = delta.type === "set" ? delta.value : progress.current + delta.value;

  return {
    current,
    target: objective.quantity,
    completed: current >= objective.quantity
  };
}
