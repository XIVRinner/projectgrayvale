import type { ActivityObjective, Delta } from "@rinner/grayvale-core";

import type { ObjectiveProgress } from "../quest-tracker";

type ActivityQuestSignal = {
  type: "activity_duration";
  activityId: string;
  amount: number;
};

export function matchesActivityDelta(
  delta: Delta,
  objective: ActivityObjective
): boolean {
  const signal = extractActivityQuestSignal(delta);

  return signal?.activityId === objective.activityId;
}

export function applyActivityObjectiveDelta(
  objective: ActivityObjective,
  progress: ObjectiveProgress,
  delta: Delta
): ObjectiveProgress | null {
  const signal = extractActivityQuestSignal(delta);

  if (!signal || signal.activityId !== objective.activityId) {
    return null;
  }

  const current = delta.type === "set" ? signal.amount : progress.current + signal.amount;

  return {
    current,
    target: objective.duration,
    completed: current >= objective.duration
  };
}

function extractActivityQuestSignal(delta: Delta): ActivityQuestSignal | null {
  const nestedSignal = parseNestedActivitySignal(delta.meta?.["questSignal"]);

  if (nestedSignal) {
    return nestedSignal;
  }

  const activityTick = parseActivityTickSignal(delta.meta?.["activityTick"]);

  if (activityTick) {
    return activityTick;
  }

  if (!delta.meta || typeof delta.meta !== "object") {
    return null;
  }

  const activityId = delta.meta["activityId"];
  const duration = toFiniteNumber(delta.meta["duration"]);
  const tickDelta = toFiniteNumber(delta.meta["tickDelta"]);
  const amount = duration ?? tickDelta;

  if (typeof activityId !== "string" || amount === null) {
    return null;
  }

  return {
    type: "activity_duration",
    activityId,
    amount
  };
}

function parseNestedActivitySignal(value: unknown): ActivityQuestSignal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const activityId = record["activityId"];
  const amount =
    toFiniteNumber(record["amount"]) ??
    toFiniteNumber(record["duration"]) ??
    toFiniteNumber(record["tickDelta"]);

  if (
    record["type"] !== "activity_duration" ||
    typeof activityId !== "string" ||
    amount === null
  ) {
    return null;
  }

  return {
    type: "activity_duration",
    activityId,
    amount
  };
}

function parseActivityTickSignal(value: unknown): ActivityQuestSignal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const activityId = record["activityId"];
  const amount =
    toFiniteNumber(record["duration"]) ??
    toFiniteNumber(record["tickDelta"]) ??
    toFiniteNumber(record["amount"]);

  if (typeof activityId !== "string" || amount === null) {
    return null;
  }

  return {
    type: "activity_duration",
    activityId,
    amount
  };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
