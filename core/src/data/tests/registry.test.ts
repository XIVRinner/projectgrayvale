import { sampleSkills, sampleWeapons } from "../examples";
import { DataRegistry } from "../registry";

describe("DataRegistry", () => {
  it("loads skills correctly", () => {
    const registry = new DataRegistry();

    registry.loadSkills(sampleSkills);

    expect(registry.getSkill("bow")).toEqual(sampleSkills[1]);
  });

  it("throws on duplicate skill IDs", () => {
    const registry = new DataRegistry();

    expect(() =>
      registry.loadSkills([sampleSkills[0], sampleSkills[0]])
    ).toThrow("Duplicate skill id: short_blade");
  });

  it("still supports weapon loading", () => {
    const registry = new DataRegistry();

    registry.loadWeapons(sampleWeapons);

    expect(registry.getWeapon("weapon_dagger_rustleaf")).toEqual(sampleWeapons[0]);
  });
});
