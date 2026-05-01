import { calculateXpRequired } from "../progression";

describe("calculateXpRequired", () => {
  it("returns the expected XP at level 1", () => {
    expect(
      calculateXpRequired(1, {
        baseXp: 100,
        growthFactor: 1.2,
        exponent: 1.35
      })
    ).toBe(120);
  });

  it("scales correctly at higher levels", () => {
    expect(
      calculateXpRequired(4, {
        baseXp: 100,
        growthFactor: 1.2,
        exponent: 1.35
      })
    ).toBeCloseTo(779.7623, 4);
  });

  it("rejects level 0", () => {
    expect(() =>
      calculateXpRequired(0, {
        baseXp: 100,
        growthFactor: 1.2,
        exponent: 1.35
      })
    ).toThrow("Level must be greater than 0.");
  });

  it("rejects negative levels", () => {
    expect(() =>
      calculateXpRequired(-3, {
        baseXp: 100,
        growthFactor: 1.2,
        exponent: 1.35
      })
    ).toThrow("Level must be greater than 0.");
  });
});
