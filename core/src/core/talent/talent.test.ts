import type { Talent } from "./talent.types";

describe("talent structure", () => {
  it("stores modifiers as Modifier[]", () => {
    const talent: Talent = {
      id: "talent_brutal_force",
      name: "Brutal Force",
      modifiers: [
        { stat: "strength", type: "add", value: 3 },
        { stat: "critChance", type: "multiply", value: 1.05 }
      ]
    };

    expect(talent.modifiers).toHaveLength(2);
    expect(talent.modifiers[0]).toEqual({ stat: "strength", type: "add", value: 3 });
  });
});