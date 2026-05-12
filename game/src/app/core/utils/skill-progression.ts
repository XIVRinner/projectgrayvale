const DEFAULT_DIFFICULTY = 1;
const SKILL_CAP_PER_DIFFICULTY = 10;
const COMBAT_XP_TO_SKILL_FACTOR = 0.1;
const LOG_FALLOFF_BASE = Math.log(10);

export type SkillRewardKind = "combat_xp" | "direct";

export interface SkillRewardCurveInput {
  readonly currentValue: number;
  readonly rawAmount: number;
  readonly difficulty: number;
  readonly rewardKind: SkillRewardKind;
}

export function resolveSkillRewardAmount(input: SkillRewardCurveInput): number {
  const cap = resolveSkillDifficultyCap(input.difficulty);
  const currentValue = Math.max(0, input.currentValue);
  const remainingHeadroom = Math.max(0, cap - currentValue);

  if (remainingHeadroom <= 0) {
    return 0;
  }

  const normalizedAmount = normalizeSkillRewardAmount(
    input.rawAmount,
    input.rewardKind,
  );

  if (normalizedAmount <= 0) {
    return 0;
  }

  const remainingRatio = remainingHeadroom / cap;
  const falloffMultiplier = Math.log1p(remainingRatio * 9) / LOG_FALLOFF_BASE;
  const adjustedAmount = normalizedAmount * falloffMultiplier;

  return Math.min(adjustedAmount, remainingHeadroom);
}

export function resolveSkillDifficultyCap(difficulty: number): number {
  const normalizedDifficulty =
    Number.isFinite(difficulty) && difficulty > 0
      ? difficulty
      : DEFAULT_DIFFICULTY;

  return normalizedDifficulty * SKILL_CAP_PER_DIFFICULTY;
}

function normalizeSkillRewardAmount(
  rawAmount: number,
  rewardKind: SkillRewardKind,
): number {
  if (!Number.isFinite(rawAmount)) {
    return 0;
  }

  if (rewardKind === "combat_xp") {
    return rawAmount * COMBAT_XP_TO_SKILL_FACTOR;
  }

  return rawAmount;
}
