import type {
  QuestReward,
  ActivityObjective,
  AttributeObjective,
  CompositeObjective,
  ItemObjective,
  KillObjective,
  Quest,
  QuestObjective
} from "./quest.types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertNonEmptyString = (
  value: unknown,
  fieldName: string,
  path: string
): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${fieldName} must be a non-empty string.`);
  }

  return value;
};

const assertPositiveNumber = (
  value: unknown,
  fieldName: string,
  path: string
): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${path}.${fieldName} must be a positive finite number.`);
  }

  return value;
};

const assertObjectiveRecord = (
  value: unknown,
  path: string
): Record<string, unknown> => {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value;
};

export function assertValidAttributeObjective(
  value: unknown,
  path = "questObjective"
): asserts value is AttributeObjective {
  const objective = assertObjectiveRecord(value, path);

  if (objective.type !== "attribute_reached") {
    throw new Error(`${path}.type must be "attribute_reached".`);
  }

  assertNonEmptyString(objective.attribute, "attribute", path);
  assertPositiveNumber(objective.target, "target", path);
}

export function assertValidItemObjective(
  value: unknown,
  path = "questObjective"
): asserts value is ItemObjective {
  const objective = assertObjectiveRecord(value, path);

  if (objective.type !== "item_collected") {
    throw new Error(`${path}.type must be "item_collected".`);
  }

  assertNonEmptyString(objective.itemId, "itemId", path);
  assertPositiveNumber(objective.quantity, "quantity", path);
}

export function assertValidActivityObjective(
  value: unknown,
  path = "questObjective"
): asserts value is ActivityObjective {
  const objective = assertObjectiveRecord(value, path);

  if (objective.type !== "activity_duration") {
    throw new Error(`${path}.type must be "activity_duration".`);
  }

  assertNonEmptyString(objective.activityId, "activityId", path);
  assertPositiveNumber(objective.duration, "duration", path);
}

export function assertValidKillObjective(
  value: unknown,
  path = "questObjective"
): asserts value is KillObjective {
  const objective = assertObjectiveRecord(value, path);

  if (objective.type !== "kill") {
    throw new Error(`${path}.type must be "kill".`);
  }

  assertNonEmptyString(objective.target, "target", path);
  assertPositiveNumber(objective.count, "count", path);
}

export function assertValidCompositeObjective(
  value: unknown,
  path = "questObjective"
): asserts value is CompositeObjective {
  const objective = assertObjectiveRecord(value, path);

  if (objective.type !== "composite") {
    throw new Error(`${path}.type must be "composite".`);
  }

  if (objective.operator !== "AND" && objective.operator !== "OR") {
    throw new Error(`${path}.operator must be "AND" or "OR".`);
  }

  if (!Array.isArray(objective.objectives)) {
    throw new Error(`${path}.objectives must be an array.`);
  }

  objective.objectives.forEach((nestedObjective, index) => {
    assertValidQuestObjective(nestedObjective, `${path}.objectives[${index}]`);
  });
}

export function assertValidQuestObjective(
  value: unknown,
  path = "questObjective"
): asserts value is QuestObjective {
  const objective = assertObjectiveRecord(value, path);

  switch (objective.type) {
    case "attribute_reached":
      assertValidAttributeObjective(objective, path);
      return;
    case "item_collected":
      assertValidItemObjective(objective, path);
      return;
    case "activity_duration":
      assertValidActivityObjective(objective, path);
      return;
    case "kill":
      assertValidKillObjective(objective, path);
      return;
    case "composite":
      assertValidCompositeObjective(objective, path);
      return;
    default:
      throw new Error(
        `${path}.type must be one of "attribute_reached", "item_collected", ` +
          `"activity_duration", "kill", or "composite".`
      );
  }
}

export function assertValidQuest(
  value: unknown,
  path = "quest"
): asserts value is Quest {
  const quest = assertObjectiveRecord(value, path);

  assertNonEmptyString(quest.id, "id", path);

  if (!Array.isArray(quest.objectives)) {
    throw new Error(`${path}.objectives must be an array.`);
  }

  quest.objectives.forEach((objective, index) => {
    assertValidQuestObjective(objective, `${path}.objectives[${index}]`);
  });

  if (quest.rewards !== undefined) {
    if (!Array.isArray(quest.rewards)) {
      throw new Error(`${path}.rewards must be an array when provided.`);
    }

    quest.rewards.forEach((reward, index) => {
      assertValidQuestReward(reward, `${path}.rewards[${index}]`);
    });
  }
}

export function assertValidQuestReward(
  value: unknown,
  path = "questReward"
): asserts value is QuestReward {
  const reward = assertObjectiveRecord(value, path);

  switch (reward.type) {
    case "attribute_unlock":
      assertNonEmptyString(reward.attributeId, "attributeId", path);
      if (reward.unlocked !== undefined && typeof reward.unlocked !== "boolean") {
        throw new Error(`${path}.unlocked must be a boolean when provided.`);
      }
      return;
    case "activity_availability":
      assertNonEmptyString(reward.activityId, "activityId", path);
      if (
        reward.status !== "locked" &&
        reward.status !== "enabled" &&
        reward.status !== "disabled"
      ) {
        throw new Error(`${path}.status must be "locked", "enabled", or "disabled".`);
      }
      if (
        reward.disabledReason !== undefined &&
        (typeof reward.disabledReason !== "string" || reward.disabledReason.trim().length === 0)
      ) {
        throw new Error(`${path}.disabledReason must be a non-empty string when provided.`);
      }
      return;
    default:
      throw new Error(
        `${path}.type must be one of "attribute_unlock" or "activity_availability".`
      );
  }
}

export const parseQuestObjective = (value: unknown): QuestObjective => {
  assertValidQuestObjective(value);
  return value;
};

export const parseQuest = (value: unknown): Quest => {
  assertValidQuest(value);
  return value;
};
