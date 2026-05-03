import type {
  ActivityReward,
  RewardDistribution,
  RewardScaling,
  RewardValue
} from "./reward.types";

export const DEFAULT_REWARD_DISTRIBUTION: RewardDistribution = {
  type: "deterministic"
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const assertValidRewardScaling = (scaling: RewardScaling): void => {
  if (scaling.source !== "skill" && scaling.source !== "attribute") {
    throw new Error('Reward scaling source must be "skill" or "attribute".');
  }

  if (typeof scaling.id !== "string" || scaling.id.trim().length === 0) {
    throw new Error("Reward scaling id must be a non-empty string.");
  }

  if (!isFiniteNumber(scaling.factor)) {
    throw new Error("Reward scaling factor must be a finite number.");
  }
};

export const assertValidRewardValue = (value: RewardValue): void => {
  switch (value.type) {
    case "flat": {
      if (!isFiniteNumber(value.amount)) {
        throw new Error("Flat reward amount must be a finite number.");
      }
      return;
    }
    case "range": {
      if (!isFiniteNumber(value.min) || !isFiniteNumber(value.max)) {
        throw new Error("Range reward values must be finite numbers.");
      }

      if (value.min > value.max) {
        throw new Error("Range reward min cannot be greater than max.");
      }
      return;
    }
    case "scaled": {
      if (!isFiniteNumber(value.base)) {
        throw new Error("Scaled reward base must be a finite number.");
      }

      assertValidRewardScaling(value.scaling);
      return;
    }
    default: {
      const unsupportedType = (value as { type?: unknown }).type;
      throw new Error(`Unsupported reward value type: ${String(unsupportedType)}.`);
    }
  }
};

export const assertValidRewardDistribution = (
  distribution: RewardDistribution
): void => {
  if (distribution.type === "deterministic") {
    return;
  }

  if (distribution.type === "random") {
    if (distribution.chance === undefined) {
      return;
    }

    if (!isFiniteNumber(distribution.chance)) {
      throw new Error("Random reward chance must be a finite number when provided.");
    }

    if (distribution.chance < 0 || distribution.chance > 1) {
      throw new Error("Random reward chance must be between 0 and 1.");
    }

    return;
  }

  throw new Error("Reward distribution type must be deterministic or random.");
};

export const getRewardDistribution = (
  reward: ActivityReward
): RewardDistribution => reward.distribution ?? DEFAULT_REWARD_DISTRIBUTION;

export const assertValidActivityReward = (reward: ActivityReward): void => {
  if (
    reward.type !== "item" &&
    reward.type !== "currency" &&
    reward.type !== "attribute" &&
    reward.type !== "skill"
  ) {
    throw new Error("Reward type must be item, currency, attribute, or skill.");
  }

  if (reward.targetId !== undefined) {
    if (typeof reward.targetId !== "string" || reward.targetId.trim().length === 0) {
      throw new Error("Reward targetId must be a non-empty string when provided.");
    }
  }

  assertValidRewardValue(reward.value);
  assertValidRewardDistribution(getRewardDistribution(reward));
};

export const validateActivityRewards = (rewards: ReadonlyArray<ActivityReward>): void => {
  for (const reward of rewards) {
    assertValidActivityReward(reward);
  }
};
