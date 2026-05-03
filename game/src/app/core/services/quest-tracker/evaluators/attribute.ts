import type { AttributeObjective, Delta } from "@rinner/grayvale-core";

import type { ObjectiveProgress } from "../quest-tracker";

export function matchesAttributeDelta(
  delta: Delta,
  objective: AttributeObjective
): boolean {
  return (
    delta.target === "player" &&
    delta.path.length === 2 &&
    delta.path[0] === "attributes" &&
    delta.path[1] === objective.attribute &&
    typeof delta.value === "number"
  );
}

export function applyAttributeObjectiveDelta(
  objective: AttributeObjective,
  progress: ObjectiveProgress,
  delta: Delta
): ObjectiveProgress | null {
  if (!matchesAttributeDelta(delta, objective) || typeof delta.value !== "number") {
    return null;
  }

  const current = delta.type === "set" ? delta.value : progress.current + delta.value;

  return finalizeProgress(current, objective.target);
}

function finalizeProgress(current: number, target: number): ObjectiveProgress {
  return {
    current,
    target,
    completed: current >= target
  };
}
