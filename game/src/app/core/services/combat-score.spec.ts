import {
  compareCombatScore,
  computeCompanionCombatScore,
  computeExpectedForLevel,
  computePlayerCombatScore,
  computeTopBottlenecks
} from "./combat-score";

describe("combat-score", () => {
  it("computes weighted player score with formula and subscores", () => {
    const result = computePlayerCombatScore({
      gearScore: 80,
      skillProficiencyScore: 50,
      preferredAttributeScore: 40
    });

    expect(result.formula).toContain("0.50*Gear");
    expect(result.total).toBe(63);
    expect(result.subscores).toHaveLength(3);
    expect(result.subscores.map((s) => s.contribution)).toEqual([40, 15, 8]);
  });

  it("computes weighted companion score", () => {
    const result = computeCompanionCombatScore({
      gearScore: 70,
      preferredRoleAlignmentScore: 40,
      starLevelScore: 90
    });

    expect(result.total).toBe(72);
    expect(result.subscores.map((s) => s.contribution)).toEqual([28, 8, 36]);
  });

  it("uses milestone overrides when present", () => {
    expect(
      computeExpectedForLevel(25, {
        base: 30,
        perLevel: 2,
        milestoneOverrides: {
          25: 123
        }
      })
    ).toBe(123);

    expect(
      computeExpectedForLevel(24, {
        base: 30,
        perLevel: 2,
        milestoneOverrides: {
          25: 123
        }
      })
    ).toBe(76);
  });

  it("compares score against expected with tier labels", () => {
    expect(compareCombatScore(60, 100).tier).toBe("underpowered");
    expect(compareCombatScore(100, 100).tier).toBe("on_curve");
    expect(compareCombatScore(130, 100).tier).toBe("overperforming");
  });

  it("returns lowest subscores as bottlenecks with hints", () => {
    const breakdown = computePlayerCombatScore({
      gearScore: 85,
      skillProficiencyScore: 20,
      preferredAttributeScore: 10
    });

    const bottlenecks = computeTopBottlenecks(breakdown);

    expect(bottlenecks).toHaveLength(3);
    expect(bottlenecks[0].key).toBe("preferred_attribute");
    expect(bottlenecks[0].hint).toContain("preferred attribute");
  });
});
