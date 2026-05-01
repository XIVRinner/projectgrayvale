import type { EquipmentItem } from "./equipment.types";
import { RARITY_DEFINITIONS } from "./rarity.definitions";
import { getRarityDefinition } from "./rarity.helpers";
import type { Rarity } from "./rarity.types";

describe("rarity definitions", () => {
  it("contains definitions for all rarity ids", () => {
    const rarities: Rarity[] = [
      "trash",
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythical",
      "ephemeral",
      "primal",
      "divine",
      "infernal",
      "cursed"
    ];

    for (const rarity of rarities) {
      expect(RARITY_DEFINITIONS[rarity]).toBeDefined();
      expect(RARITY_DEFINITIONS[rarity].id).toBe(rarity);
      expect(RARITY_DEFINITIONS[rarity].description.length).toBeGreaterThan(0);
      expect(RARITY_DEFINITIONS[rarity].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("returns registry entries from getRarityDefinition", () => {
    const definition = getRarityDefinition("legendary");

    expect(definition).toEqual(RARITY_DEFINITIONS.legendary);
    expect(definition.name).toBe("Legendary");
    expect(definition.id).toBe("legendary");
  });
});

describe("equipment item typing", () => {
  it("supports rarity and icon fields", () => {
    const item: EquipmentItem = {
      id: "weapon_test_relic",
      name: "Test Relic",
      rarity: "epic",
      icon: "assets/icons/weapons/test-relic.png",
      allowedSlots: ["mainHand"],
      tags: ["test"]
    };

    expect(item.rarity).toBe("epic");
    expect(item.icon).toBe("assets/icons/weapons/test-relic.png");
  });
});