import {
  inventoryEquipmentItemSchema,
  inventoryItemDefinitionSchema
} from "@rinner/grayvale-core";

import {
  parseEquipmentItemWithGameFields,
  parseInventoryItemWithGameFields
} from "./character-sheet-item-assets";

describe("character-sheet item asset parsing", () => {
  it("preserves equipment damage profiles while parsing through the core schema", () => {
    const item = parseEquipmentItemWithGameFields(
      {
        id: "weapon_dagger_rustleaf",
        name: "Old Dagger",
        category: "equipment",
        rarity: "uncommon",
        iconPath: "assets/images/resources/items/equipment/rusty-dagger.svg",
        tags: ["dagger", "melee", "short_blade"],
        slot: "main_hand",
        itemLevel: 1,
        damage: {
          piercing: { min: 5, max: 10 },
          slashing: { min: 2, max: 5 }
        },
        combatStats: [{ stat: "dodge_chance", value: 0.04, operation: "add" }]
      },
      (entry) => inventoryEquipmentItemSchema.parse(entry)
    );

    expect(item.iconPath).toBe("assets/images/resources/items/equipment/rusty-dagger.svg");
    expect(item.damage).toEqual({
      piercing: { min: 5, max: 10 },
      slashing: { min: 2, max: 5 }
    });
  });

  it("preserves damage on equipment entries inside the inventory item union parser", () => {
    const item = parseInventoryItemWithGameFields(
      {
        id: "weapon_dagger_rustleaf",
        name: "Old Dagger",
        category: "equipment",
        rarity: "uncommon",
        tags: ["dagger", "melee", "short_blade"],
        slot: "main_hand",
        itemLevel: 1,
        damage: {
          piercing: { min: 5, max: 10 }
        }
      },
      (entry) => inventoryItemDefinitionSchema.parse(entry)
    );

    expect(item.category).toBe("equipment");
    if (item.category === "equipment") {
      expect(item.damage).toEqual({
        piercing: { min: 5, max: 10 }
      });
    }
  });
});
