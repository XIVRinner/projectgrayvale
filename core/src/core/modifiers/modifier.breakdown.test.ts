import {
  computeStatBreakdown,
  computeStatBreakdowns
} from "./modifier.pipeline";
import type { LabeledModifier } from "./modifier.types";

const equipment = (
  stat: string,
  value: number,
  active = true,
  special?: boolean
): LabeledModifier => ({
  stat,
  type: "add",
  value,
  source: "Test Equipment",
  category: "equipment",
  active,
  ...(special !== undefined ? { special } : {})
});

const buff = (stat: string, value: number, active = true): LabeledModifier => ({
  stat,
  type: "add",
  value,
  source: "Haste Potion",
  category: "buff",
  active
});

const debuff = (stat: string, value: number, active = true): LabeledModifier => ({
  stat,
  type: "add",
  value,
  source: "Cursed Ring",
  category: "debuff",
  active
});

describe("computeStatBreakdown — issue examples", () => {
  it("models Strength buffed by equipment (base 20, +20 ring → 40, buffed)", () => {
    const result = computeStatBreakdown("strength", 20, [
      {
        stat: "strength",
        type: "add",
        value: 20,
        source: "Brutal Ring",
        category: "equipment",
        active: true
      }
    ]);

    expect(result.stat).toBe("strength");
    expect(result.base).toBe(20);
    expect(result.final).toBe(40);
    expect(result.displayState).toBe("buffed");
    expect(result.modifiers).toHaveLength(1);
    expect(result.modifiers[0].source).toBe("Brutal Ring");
  });

  it("models Mentality nerfed by debuff (base 30, -20 ring → 10, nerfed)", () => {
    const result = computeStatBreakdown("mentality", 30, [
      {
        stat: "mentality",
        type: "add",
        value: -20,
        source: "Cursed Ring",
        category: "debuff",
        active: true
      }
    ]);

    expect(result.stat).toBe("mentality");
    expect(result.base).toBe(30);
    expect(result.final).toBe(10);
    expect(result.displayState).toBe("nerfed");
  });
});

describe("computeStatBreakdown — display states", () => {
  it("returns buffed when active add modifiers raise the value", () => {
    const result = computeStatBreakdown("strength", 10, [equipment("strength", 5)]);
    expect(result.final).toBe(15);
    expect(result.displayState).toBe("buffed");
  });

  it("returns nerfed when active add modifiers lower the value", () => {
    const result = computeStatBreakdown("defense", 10, [debuff("defense", -3)]);
    expect(result.final).toBe(7);
    expect(result.displayState).toBe("nerfed");
  });

  it("returns neutral when there are no modifiers", () => {
    const result = computeStatBreakdown("agility", 10, []);
    expect(result.final).toBe(10);
    expect(result.displayState).toBe("neutral");
  });

  it("returns neutral when active modifiers cancel out", () => {
    const result = computeStatBreakdown("agility", 10, [
      buff("agility", 5),
      debuff("agility", -5)
    ]);
    expect(result.final).toBe(10);
    expect(result.displayState).toBe("neutral");
  });

  it("returns muted when all modifiers are inactive", () => {
    const result = computeStatBreakdown("strength", 10, [
      equipment("strength", 5, false)
    ]);
    expect(result.final).toBe(10);
    expect(result.displayState).toBe("muted");
  });

  it("returns muted when active modifiers cancel but inactive ones exist", () => {
    const result = computeStatBreakdown("strength", 10, [
      buff("strength", 5),
      debuff("strength", -5),
      equipment("strength", 3, false)
    ]);
    expect(result.final).toBe(10);
    expect(result.displayState).toBe("muted");
  });

  it("returns special when active modifier is flagged as special and raises value", () => {
    const result = computeStatBreakdown("strength", 10, [
      equipment("strength", 10, true, true)
    ]);
    expect(result.final).toBe(20);
    expect(result.displayState).toBe("special");
  });

  it("does not return special for a special modifier that nerfs the stat", () => {
    const result = computeStatBreakdown("strength", 20, [
      {
        stat: "strength",
        type: "add",
        value: -5,
        source: "Cursed Legendary Ring",
        category: "debuff",
        active: true,
        special: true
      }
    ]);
    expect(result.final).toBe(15);
    expect(result.displayState).toBe("nerfed");
  });
});

describe("computeStatBreakdown — inactive modifiers", () => {
  it("ignores inactive modifiers in final value", () => {
    const result = computeStatBreakdown("strength", 10, [
      equipment("strength", 20, false),
      buff("strength", 5, true)
    ]);
    expect(result.final).toBe(15);
    expect(result.displayState).toBe("buffed");
  });

  it("includes inactive modifiers in the modifiers list", () => {
    const inactive = equipment("strength", 20, false);
    const result = computeStatBreakdown("strength", 10, [inactive]);
    expect(result.modifiers).toHaveLength(1);
    expect(result.modifiers[0].active).toBe(false);
  });
});

describe("computeStatBreakdown — multiplicative modifiers", () => {
  it("applies multiply modifiers on active modifiers only", () => {
    const result = computeStatBreakdown("damage", 10, [
      {
        stat: "damage",
        type: "multiply",
        value: 2,
        source: "Power Aura",
        category: "buff",
        active: true
      }
    ]);
    expect(result.final).toBe(20);
    expect(result.displayState).toBe("buffed");
  });

  it("does not apply inactive multiply modifier", () => {
    const result = computeStatBreakdown("damage", 10, [
      {
        stat: "damage",
        type: "multiply",
        value: 2,
        source: "Power Aura",
        category: "buff",
        active: false
      }
    ]);
    expect(result.final).toBe(10);
    expect(result.displayState).toBe("muted");
  });
});

describe("computeStatBreakdowns", () => {
  it("returns a breakdown for each stat in baseStats", () => {
    const result = computeStatBreakdowns({ strength: 20, defense: 10 }, []);
    expect(Object.keys(result)).toEqual(expect.arrayContaining(["strength", "defense"]));
    expect(result.strength.base).toBe(20);
    expect(result.defense.base).toBe(10);
  });

  it("includes stats that only appear in modifiers", () => {
    const result = computeStatBreakdowns({}, [
      buff("mana", 50)
    ]);
    expect(result.mana).toBeDefined();
    expect(result.mana.base).toBe(0);
    expect(result.mana.final).toBe(50);
    expect(result.mana.displayState).toBe("buffed");
  });

  it("routes modifiers to the correct stat breakdown", () => {
    const result = computeStatBreakdowns(
      { strength: 20, defense: 10 },
      [
        { stat: "strength", type: "add", value: 10, source: "Brutal Ring", category: "equipment", active: true },
        { stat: "defense", type: "add", value: -5, source: "Cursed Gloves", category: "debuff", active: true }
      ]
    );
    expect(result.strength.final).toBe(30);
    expect(result.strength.displayState).toBe("buffed");
    expect(result.defense.final).toBe(5);
    expect(result.defense.displayState).toBe("nerfed");
  });

  it("does not mutate input baseStats", () => {
    const base = { strength: 10 };
    computeStatBreakdowns(base, [buff("strength", 5)]);
    expect(base).toEqual({ strength: 10 });
  });
});

describe("StatBreakdown — source labels", () => {
  it("preserves source label on each modifier", () => {
    const result = computeStatBreakdown("vitality", 15, [
      { stat: "vitality", type: "add", value: 5, source: "Iron Shield", category: "equipment", active: true }
    ]);
    expect(result.modifiers[0].source).toBe("Iron Shield");
  });

  it("supports multiple modifiers with distinct sources", () => {
    const result = computeStatBreakdown("strength", 10, [
      { stat: "strength", type: "add", value: 5, source: "Ring of Power", category: "equipment", active: true },
      { stat: "strength", type: "add", value: 3, source: "Warcry", category: "buff", active: true }
    ]);
    expect(result.modifiers.map((m) => m.source)).toEqual(["Ring of Power", "Warcry"]);
  });
});

describe("StatBreakdown — category support", () => {
  it("supports conditional modifiers", () => {
    const result = computeStatBreakdown("agility", 10, [
      {
        stat: "agility",
        type: "add",
        value: 5,
        source: "Sprint Rune (low health)",
        category: "conditional",
        active: false
      }
    ]);
    expect(result.modifiers[0].category).toBe("conditional");
    expect(result.displayState).toBe("muted");
  });
});
