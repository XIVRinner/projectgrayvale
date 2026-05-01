import type { Modifier } from "../modifiers";
import { getRaceImagePath } from "./race.helpers";
import type { Race } from "./race.types";

describe("race structure", () => {
  it("supports optional variants and starting bonuses with Modifier entries", () => {
    const startingBonuses: Modifier[] = [
      { stat: "strength", type: "add", value: 2 },
      { stat: "vitality", type: "multiply", value: 1.1 }
    ];

    const race: Race = {
      id: "race_human",
      name: "Human",
      slug: "human",
      imageBasePath: "assets/races/human",
      variants: {
        warm: ["0.png", "1.png"],
        cool: ["2.png"],
        exotic: ["3.png"]
      },
      startingBonuses
    };

    expect(race.startingBonuses).toEqual(startingBonuses);
    expect(race.variants?.warm).toEqual(["0.png", "1.png"]);
  });
});

describe("getRaceImagePath", () => {
  it("builds a variant and index based png path", () => {
    const race: Race = {
      id: "race_elf",
      name: "Elf",
      slug: "elf",
      imageBasePath: "assets/races/elf"
    };

    expect(getRaceImagePath(race, "warm", 2)).toBe("assets/races/elf/warm/2.png");
  });

  it("normalizes trailing slashes in base path", () => {
    const race: Race = {
      id: "race_orc",
      name: "Orc",
      slug: "orc",
      imageBasePath: "assets/races/orc///"
    };

    expect(getRaceImagePath(race, "cool", 0)).toBe("assets/races/orc/cool/0.png");
  });
});