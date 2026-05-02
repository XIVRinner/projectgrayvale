import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findScalingOverride,
  getScalar,
  type BalanceProfile
} from "./index";

const loadFixture = (): BalanceProfile =>
  JSON.parse(
    readFileSync(join(__dirname, "balance.fixture.json"), "utf8")
  ) as BalanceProfile;

describe("getScalar", () => {
  it("returns 1.0 when no profile is provided", () => {
    expect(getScalar(undefined, "attributes", "strength")).toBe(1);
  });

  it("returns 1.0 when the scalar key is missing", () => {
    const profile = loadFixture();

    expect(getScalar(profile, "skills", "alchemy")).toBe(1);
  });

  it("returns the scalar override when present", () => {
    const profile = loadFixture();

    expect(getScalar(profile, "attributes", "strength")).toBe(0.5);
  });
});

describe("findScalingOverride", () => {
  it("finds a matching scaling override", () => {
    const profile = loadFixture();

    expect(
      findScalingOverride(profile, "weapon.shortBlade", "strength")
    ).toEqual({
      target: "weapon.shortBlade",
      attribute: "strength",
      multiplier: 2
    });
  });

  it("returns undefined when the override is missing", () => {
    const profile = loadFixture();

    expect(
      findScalingOverride(profile, "weapon.shortBlade", "agility")
    ).toBeUndefined();
  });
});
