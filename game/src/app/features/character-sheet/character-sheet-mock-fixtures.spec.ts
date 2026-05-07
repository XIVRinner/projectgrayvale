import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  inventoryEquipmentItemSchema,
  inventoryItemDefinitionSchema,
  sampleLoadouts
} from "@rinner/grayvale-core";

const readJson = (fileName: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, "../../../assets/data", fileName), "utf8"));

describe("character sheet mock fixtures", () => {
  it("provides required character-sheet MVP equipment examples", () => {
    const equipmentItems = inventoryEquipmentItemSchema.array().parse(readJson("equipment-items.json"));
    const names = new Set(equipmentItems.map((item) => item.name));

    expect(Array.from(names)).toEqual(
      expect.arrayContaining(["Old Dagger", "Rags", "Worn Leather Chestpiece", "Ring of Split Mind"])
    );

    const ring = equipmentItems.find((item) => item.id === "ring_bone_carved");
    expect(ring?.combatStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stat: "strength", value: 20, operation: "add" }),
        expect.objectContaining({ stat: "mentality", value: -20, operation: "add" })
      ])
    );

    expect(
      equipmentItems.some((item) => item.rarity === "legendary" || item.rarity === "divine")
    ).toBe(true);
    expect(equipmentItems.some((item) => item.specialRarity)).toBe(true);
  });

  it("covers all inventory categories and rarity tooltip cases", () => {
    const items = inventoryItemDefinitionSchema.array().parse(readJson("inventory-items.json"));

    expect(new Set(items.map((item) => item.category))).toEqual(
      new Set(["equipment", "material", "quest_item", "junk"])
    );

    expect(
      items.some((item) => item.category === "material" && item.qualityStars && item.qualityStars > 0)
    ).toBe(true);
    expect(
      items.some(
        (item) =>
          item.category === "material" &&
          (item.specialRarity === "legendary" ||
            item.specialRarity === "divine" ||
            item.specialRarity === "infernal") &&
          item.qualityStars === undefined
      )
    ).toBe(true);
  });

  it("exposes required mock loadouts with both filled and empty slots", () => {
    expect(Object.values(sampleLoadouts).map((loadout) => loadout.displayName)).toEqual(
      expect.arrayContaining(["Default", "Dodge Build"])
    );

    const defaultLoadout = sampleLoadouts.loadout_default;
    const filledSlotCount = Object.keys(defaultLoadout.slots).length;
    expect(filledSlotCount).toBeGreaterThan(0);
    expect(filledSlotCount).toBeLessThan(8);
  });
});
