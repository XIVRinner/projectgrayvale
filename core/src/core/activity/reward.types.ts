export type RewardKind = "item" | "currency" | "attribute" | "skill";

export type RewardScalingSource = "skill" | "attribute" | "healing_done";

export type RewardScaling = {
  source: RewardScalingSource;
  id?: string;
  factor: number;
};

export type FlatRewardValue = {
  type: "flat";
  amount: number;
};

export type RangeRewardValue = {
  type: "range";
  min: number;
  max: number;
};

export type ScaledRewardValue = {
  type: "scaled";
  base: number;
  scaling: RewardScaling;
};

export type RewardValue = FlatRewardValue | RangeRewardValue | ScaledRewardValue;

export type DeterministicRewardDistribution = {
  type: "deterministic";
};

export type RandomRewardDistribution = {
  type: "random";
  chance?: number;
};

export type RandomIntervalRewardDistribution = {
  type: "random_interval";
  tickMin: number;
  tickMax: number;
};

export type RewardDistribution =
  | DeterministicRewardDistribution
  | RandomRewardDistribution
  | RandomIntervalRewardDistribution;

export type ActivityReward = {
  type: RewardKind;
  targetId?: string;
  value: RewardValue;
  distribution?: RewardDistribution;
  maxHealPercent?: number;
};
