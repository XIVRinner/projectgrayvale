import { CombatScoreFacade } from "./combat-score-facade";

describe("CombatScoreFacade", () => {
  const facade = new CombatScoreFacade();
  const expectedConfig = {
    base: 20,
    perLevel: 4,
    milestoneOverrides: {
      10: 80
    }
  } as const;

  it("builds a player summary dto with breakdown, comparison, and bottlenecks", () => {
    const summary = facade.buildPlayerSummary({
      level: 10,
      input: {
        gearScore: 70,
        skillProficiencyScore: 40,
        preferredAttributeScore: 50
      },
      expectedConfig
    });

    expect(summary.breakdown.total).toBe(57);
    expect(summary.comparison.expectedScore).toBe(80);
    expect(summary.comparison.percentOfExpected).toBe(71);
    expect(summary.bottlenecks.length).toBe(3);
  });

  it("builds a companion summary dto and respects bottleneck limits", () => {
    const summary = facade.buildCompanionSummary({
      level: 11,
      input: {
        gearScore: 60,
        preferredRoleAlignmentScore: 20,
        starLevelScore: 80
      },
      expectedConfig,
      bottleneckLimit: 2
    });

    expect(summary.breakdown.total).toBe(60);
    expect(summary.comparison.expectedScore).toBe(60);
    expect(summary.comparison.tier).toBe("on_curve");
    expect(summary.bottlenecks.length).toBe(2);
  });
});
