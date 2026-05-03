import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertValidActivityReward,
  assertValidRewardDistribution,
  assertValidRewardScaling,
  assertValidRewardValue,
  getRewardDistribution,
  type ActivityReward
} from "./index";

const loadFixture = (): ActivityReward[] =>
  JSON.parse(readFileSync(join(__dirname, "reward.fixture.json"), "utf8")) as ActivityReward[];

describe("activity reward", () => {
  it("supports flat, range, and scaled reward values", () => {
    expect(() =>
      assertValidRewardValue({
        type: "flat",
        amount: 4
      })
    ).not.toThrow();

    expect(() =>
      assertValidRewardValue({
        type: "range",
        min: 1,
        max: 5
      })
    ).not.toThrow();

    expect(() =>
      assertValidRewardValue({
        type: "scaled",
        base: 2,
        scaling: {
          source: "attribute",
          id: "vitality",
          factor: 0.5
        }
      })
    ).not.toThrow();
  });

  it("accepts deterministic and random distribution shapes", () => {
    expect(() => assertValidRewardDistribution({ type: "deterministic" })).not.toThrow();
    expect(() => assertValidRewardDistribution({ type: "random" })).not.toThrow();
    expect(() => assertValidRewardDistribution({ type: "random", chance: 0.25 })).not.toThrow();
  });

  it("validates reward scaling structure", () => {
    expect(() =>
      assertValidRewardScaling({
        source: "skill",
        id: "labour",
        factor: 0.5
      })
    ).not.toThrow();

    expect(() =>
      assertValidRewardScaling({
        source: "attribute",
        id: "vitality",
        factor: 0.25
      })
    ).not.toThrow();
  });

  it("uses deterministic distribution when distribution is missing", () => {
    const reward: ActivityReward = {
      type: "currency",
      value: {
        type: "flat",
        amount: 5
      }
    };

    expect(getRewardDistribution(reward)).toEqual({ type: "deterministic" });
    expect(() => assertValidActivityReward(reward)).not.toThrow();
  });

  it("loads fixture rewards and validates all entries", () => {
    const fixture = loadFixture();

    expect(fixture).toHaveLength(3);
    expect(() => {
      fixture.forEach((reward) => {
        assertValidActivityReward(reward);
      });
    }).not.toThrow();
  });

  it("rejects invalid range and random chance values", () => {
    expect(() =>
      assertValidActivityReward({
        type: "currency",
        value: {
          type: "range",
          min: 10,
          max: 3
        },
        distribution: {
          type: "random",
          chance: 2
        }
      })
    ).toThrow("Range reward min cannot be greater than max.");

    expect(() =>
      assertValidRewardDistribution({
        type: "random",
        chance: -0.2
      })
    ).toThrow("Random reward chance must be between 0 and 1.");
  });
});
