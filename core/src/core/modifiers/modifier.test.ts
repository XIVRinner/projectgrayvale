import type { Player } from "../models";
import {
  collectModifiers,
  computeFinalStats,
  getAttributeModifiers,
  getEquipmentModifiers,
  getSkillModifiers,
  type Modifier,
  type ModifierSourceItem
} from "./index";

const createPlayer = (): Player => ({
  id: "player_modifier_test",
  name: "Modifier Test Player",
  description: "A player used for modifier pipeline tests.",
  race: "human",
  jobClass: "wanderer",
  progression: {
    level: 1,
    experience: 0
  },
  adventurerRank: 1,
  attributes: {
    strength: 5,
    vitality: 3
  },
  skills: {
    swordsmanship: 2
  },
  inventory: {
    items: {}
  },
  equippedItems: {}
});

describe("computeFinalStats", () => {
  it("applies additive modifiers only", () => {
    expect(
      computeFinalStats(
        { damage: 10 },
        [
          { stat: "damage", type: "add", value: 5 },
          { stat: "damage", type: "add", value: 3 }
        ]
      )
    ).toEqual({ damage: 18 });
  });

  it("applies multiplicative modifiers only", () => {
    expect(
      computeFinalStats(
        { damage: 10 },
        [{ stat: "damage", type: "multiply", value: 1.5 }]
      )
    ).toEqual({ damage: 15 });
  });

  it("applies additive modifiers before multiplicative modifiers", () => {
    expect(
      computeFinalStats(
        { damage: 10 },
        [
          { stat: "damage", type: "add", value: 5 },
          { stat: "damage", type: "multiply", value: 1.5 }
        ]
      )
    ).toEqual({ damage: 22.5 });
  });

  it("computes multiple stats independently", () => {
    expect(
      computeFinalStats(
        { damage: 10, defense: 20 },
        [
          { stat: "damage", type: "add", value: 2 },
          { stat: "damage", type: "multiply", value: 2 },
          { stat: "defense", type: "add", value: -5 },
          { stat: "defense", type: "multiply", value: 1.5 }
        ]
      )
    ).toEqual({
      damage: 24,
      defense: 22.5
    });
  });

  it("returns a copied stat block when modifiers are empty", () => {
    const baseStats = { damage: 10 };

    const result = computeFinalStats(baseStats, []);

    expect(result).toEqual({ damage: 10 });
    expect(result).not.toBe(baseStats);
  });

  it("initializes unknown stats from zero", () => {
    expect(
      computeFinalStats(
        {},
        [{ stat: "hp", type: "add", value: 25 }]
      )
    ).toEqual({ hp: 25 });
  });

  it("supports negative modifiers", () => {
    expect(
      computeFinalStats(
        { defense: 10 },
        [
          { stat: "defense", type: "add", value: -3 },
          { stat: "defense", type: "multiply", value: -2 }
        ]
      )
    ).toEqual({ defense: -14 });
  });

  it("does not mutate input objects", () => {
    const baseStats = { damage: 10 };
    const modifiers: Modifier[] = [
      { stat: "damage", type: "add", value: 5 }
    ];

    const baseSnapshot = { ...baseStats };
    const modifiersSnapshot = modifiers.map((modifier) => ({ ...modifier }));

    const result = computeFinalStats(baseStats, modifiers);

    expect(result).toEqual({ damage: 15 });
    expect(baseStats).toEqual(baseSnapshot);
    expect(modifiers).toEqual(modifiersSnapshot);
  });
});

describe("modifier providers", () => {
  it("maps attributes to add modifiers", () => {
    expect(getAttributeModifiers(createPlayer())).toEqual([
      { stat: "strength", type: "add", value: 5 },
      { stat: "vitality", type: "add", value: 3 }
    ]);
  });

  it("maps skills to add modifiers", () => {
    expect(getSkillModifiers(createPlayer())).toEqual([
      { stat: "swordsmanship", type: "add", value: 2 }
    ]);
  });

  it("collects modifiers from attributes, skills, and equipment", () => {
    const player = createPlayer();
    const equipmentItems: ModifierSourceItem[] = [
      {
        modifiers: [
          { stat: "damage", type: "add", value: 4 },
          { stat: "defense", type: "multiply", value: 1.1 }
        ]
      }
    ];

    expect(collectModifiers(player, equipmentItems)).toEqual([
      { stat: "strength", type: "add", value: 5 },
      { stat: "vitality", type: "add", value: 3 },
      { stat: "swordsmanship", type: "add", value: 2 },
      { stat: "damage", type: "add", value: 4 },
      { stat: "defense", type: "multiply", value: 1.1 }
    ]);
  });

  it("returns copied equipment modifiers", () => {
    const equipmentItems: ModifierSourceItem[] = [
      {
        modifiers: [{ stat: "damage", type: "add", value: 4 }]
      }
    ];

    const result = getEquipmentModifiers(equipmentItems);

    expect(result).toEqual([{ stat: "damage", type: "add", value: 4 }]);
    expect(result[0]).not.toBe(equipmentItems[0].modifiers?.[0]);
  });
});
