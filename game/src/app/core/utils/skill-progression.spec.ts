import {
  resolveSkillDifficultyCap,
  resolveSkillRewardAmount,
} from "./skill-progression";

describe("skill progression", () => {
  it("uses activity difficulty to set the skill cap", () => {
    expect(resolveSkillDifficultyCap(7)).toBe(70);
  });

  it("normalizes combat skill xp into smaller early skill gains", () => {
    expect(
      resolveSkillRewardAmount({
        currentValue: 0,
        rawAmount: 4,
        difficulty: 6,
        rewardKind: "combat_xp",
      }),
    ).toBeCloseTo(0.4, 5);
  });

  it("falls off as the skill approaches the activity difficulty cap", () => {
    const earlyGain = resolveSkillRewardAmount({
      currentValue: 5,
      rawAmount: 0.4,
      difficulty: 6,
      rewardKind: "direct",
    });
    const lateGain = resolveSkillRewardAmount({
      currentValue: 55,
      rawAmount: 0.4,
      difficulty: 6,
      rewardKind: "direct",
    });

    expect(lateGain).toBeGreaterThan(0);
    expect(lateGain).toBeLessThan(earlyGain);
  });

  it("stops awarding skill progress once the difficulty cap is reached", () => {
    expect(
      resolveSkillRewardAmount({
        currentValue: 70,
        rawAmount: 4,
        difficulty: 7,
        rewardKind: "combat_xp",
      }),
    ).toBe(0);
  });
});
