import type { Delta, KillObjective } from "@rinner/grayvale-core";

import type { ObjectiveProgress } from "../quest-tracker";

type KillQuestSignal = {
  type: "kill";
  target: string;
  amount: number;
};

export function matchesKillDelta(delta: Delta, objective: KillObjective): boolean {
  const signal = extractKillQuestSignal(delta);

  return signal?.target === objective.target;
}

export function applyKillObjectiveDelta(
  objective: KillObjective,
  progress: ObjectiveProgress,
  delta: Delta
): ObjectiveProgress | null {
  const signal = extractKillQuestSignal(delta);

  if (!signal || signal.target !== objective.target) {
    return null;
  }

  const current = delta.type === "set" ? signal.amount : progress.current + signal.amount;

  return {
    current,
    target: objective.count,
    completed: current >= objective.count
  };
}

function extractKillQuestSignal(delta: Delta): KillQuestSignal | null {
  const nestedSignal = parseNestedKillSignal(delta.meta?.["questSignal"]);

  if (nestedSignal) {
    return nestedSignal;
  }

  if (!delta.meta || typeof delta.meta !== "object") {
    return null;
  }

  const target = delta.meta["killTarget"];
  const amount = toFiniteNumber(delta.meta["killCount"]) ?? toFiniteNumber(delta.meta["count"]);

  if (typeof target !== "string" || amount === null) {
    return null;
  }

  return {
    type: "kill",
    target,
    amount
  };
}

function parseNestedKillSignal(value: unknown): KillQuestSignal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const target = record["target"];
  const amount =
    toFiniteNumber(record["amount"]) ??
    toFiniteNumber(record["count"]) ??
    toFiniteNumber(record["killCount"]);

  if (record["type"] !== "kill" || typeof target !== "string" || amount === null) {
    return null;
  }

  return {
    type: "kill",
    target,
    amount
  };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
