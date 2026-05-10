import type {
  BaseInventoryItem,
  EquipmentRequirements,
  InventoryEquipmentItem,
  InventoryItemDefinition,
  InventoryJunkItem,
  InventoryMaterialItem,
  InventoryQuestItem,
  ItemCategory,
  MaterialQuality,
  QuestItemDesignation,
  SpecialRarity
} from "./inventory-item.types";

describe("ItemCategory", () => {
  it("covers all four inventory categories", () => {
    const categories: ItemCategory[] = [
      "equipment",
      "material",
      "quest_item",
      "junk"
    ];

    expect(categories).toHaveLength(4);
  });
});

describe("SpecialRarity", () => {
  it("covers all special-rarity tiers", () => {
    const specials: SpecialRarity[] = [
      "legendary",
      "mythical",
      "ephemeral",
      "primal",
      "divine",
      "infernal",
      "cursed"
    ];

    expect(specials).toHaveLength(7);
  });
});

describe("BaseInventoryItem", () => {
  it("accepts a valid base item with required fields", () => {
    const item: BaseInventoryItem = {
      id: "item_test",
      name: "Test Item",
      category: "junk",
      rarity: "common",
      tags: []
    };

    expect(item.id).toBe("item_test");
    expect(item.specialRarity).toBeUndefined();
    expect(item.description).toBeUndefined();
    expect(item.flavor).toBeUndefined();
  });

  it("accepts optional description, flavor and specialRarity fields", () => {
    const item: BaseInventoryItem = {
      id: "item_test_full",
      name: "Full Item",
      category: "material",
      rarity: "legendary",
      specialRarity: "legendary",
      tags: ["rare"],
      description: "An extraordinary find.",
      flavor: "The air tastes of old iron."
    };

    expect(item.specialRarity).toBe("legendary");
    expect(item.description).toBe("An extraordinary find.");
    expect(item.flavor).toBe("The air tastes of old iron.");
  });
});

describe("InventoryEquipmentItem", () => {
  it("accepts a minimal equipment item", () => {
    const item: InventoryEquipmentItem = {
      id: "item_helm_iron",
      name: "Iron Helm",
      category: "equipment",
      rarity: "common",
      tags: ["armor", "head"],
      slot: "head",
      itemLevel: 5
    };

    expect(item.category).toBe("equipment");
    expect(item.slot).toBe("head");
    expect(item.itemLevel).toBe(5);
    expect(item.combatStats).toBeUndefined();
    expect(item.specialEffects).toBeUndefined();
    expect(item.tooltip).toBeUndefined();
  });

  it("accepts an equipment item with requirements and combat stats", () => {
    const requirements: EquipmentRequirements = {
      levelRequirement: 10,
      skillRequirement: { skillId: "skill_sword", level: 5 }
    };

    const item: InventoryEquipmentItem = {
      id: "item_sword_epic",
      name: "Galeforged Blade",
      category: "equipment",
      rarity: "epic",
      tags: ["sword", "melee"],
      slot: "main_hand",
      itemLevel: 20,
      requirements,
      damage: {
        piercing: { min: 8, max: 14 },
        slashing: { min: 4, max: 9 }
      },
      combatStats: [
        { stat: "physical_damage", value: 40, operation: "add" },
        { stat: "attack_speed", value: 0.05, operation: "multiply" }
      ],
      specialEffects: ["effect_wind_burst"],
      tooltip: {
        statLines: ["+40 Physical Damage", "+5% Attack Speed"],
        effectLines: ["On hit: Wind Burst (5% chance)"],
        flavorText: "Forged in a gale."
      }
    };

    expect(item.requirements?.levelRequirement).toBe(10);
    expect(item.damage?.piercing).toEqual({ min: 8, max: 14 });
    expect(item.combatStats).toHaveLength(2);
    expect(item.specialEffects).toContain("effect_wind_burst");
    expect(item.tooltip?.statLines).toHaveLength(2);
  });
});

describe("InventoryMaterialItem", () => {
  it("accepts a material with quality stars", () => {
    const item: InventoryMaterialItem = {
      id: "mat_silver_ore",
      name: "Silver Ore",
      category: "material",
      rarity: "uncommon",
      tags: ["ore", "metal"],
      quantity: 5,
      qualityStars: 3
    };

    expect(item.category).toBe("material");
    expect(item.quantity).toBe(5);
    expect(item.qualityStars).toBe(3);
  });

  it("accepts a legendary material without quality stars", () => {
    const item: InventoryMaterialItem = {
      id: "mat_divine_shard",
      name: "Divine Shard",
      category: "material",
      rarity: "divine",
      specialRarity: "divine",
      tags: ["shard", "divine"],
      quantity: 1,
      craftingTags: ["divine-smithing"]
    };

    expect(item.specialRarity).toBe("divine");
    expect(item.qualityStars).toBeUndefined();
  });

  it("supports all valid quality star values", () => {
    const qualities: MaterialQuality[] = [1, 2, 3, 4, 5];

    for (const q of qualities) {
      const item: InventoryMaterialItem = {
        id: `mat_q${q}`,
        name: `Quality ${q} Ore`,
        category: "material",
        rarity: "common",
        tags: [],
        quantity: 1,
        qualityStars: q
      };
      expect(item.qualityStars).toBe(q);
    }
  });
});

describe("InventoryQuestItem", () => {
  it("accepts a usable quest item", () => {
    const item: InventoryQuestItem = {
      id: "quest_item_map_fragment",
      name: "Map Fragment",
      category: "quest_item",
      rarity: "uncommon",
      tags: ["map", "quest"],
      questContext: "quest_the_lost_path",
      usable: true
    };

    expect(item.category).toBe("quest_item");
    expect(item.questContext).toBe("quest_the_lost_path");
    expect(item.usable).toBe(true);
    expect(item.locked).toBeUndefined();
    expect(item.designation).toBeUndefined();
  });

  it("accepts a locked quest item with all designations", () => {
    const designations: QuestItemDesignation[] = [
      "temporal",
      "secret",
      "special"
    ];

    for (const designation of designations) {
      const item: InventoryQuestItem = {
        id: `quest_item_${designation}`,
        name: `Designated Item`,
        category: "quest_item",
        rarity: "rare",
        tags: [],
        questContext: "quest_test",
        usable: false,
        locked: true,
        designation
      };
      expect(item.designation).toBe(designation);
      expect(item.locked).toBe(true);
    }
  });
});

describe("InventoryJunkItem", () => {
  it("accepts a junk item with sell value", () => {
    const item: InventoryJunkItem = {
      id: "junk_cracked_lens",
      name: "Cracked Lens",
      category: "junk",
      rarity: "trash",
      tags: ["glass"],
      sellValue: 3,
      flavor: "Scratched beyond use."
    };

    expect(item.category).toBe("junk");
    expect(item.sellValue).toBe(3);
  });

  it("accepts a junk item without sell value", () => {
    const item: InventoryJunkItem = {
      id: "junk_torn_cloth",
      name: "Torn Cloth",
      category: "junk",
      rarity: "trash",
      tags: []
    };

    expect(item.sellValue).toBeUndefined();
  });
});

describe("InventoryItemDefinition discriminated union", () => {
  it("narrows to InventoryEquipmentItem on equipment category", () => {
    const item: InventoryItemDefinition = {
      id: "item_test_eq",
      name: "Test Equipment",
      category: "equipment",
      rarity: "common",
      tags: [],
      slot: "chest",
      itemLevel: 1
    };

    if (item.category === "equipment") {
      expect(item.slot).toBe("chest");
    } else {
      fail("Expected equipment category");
    }
  });

  it("narrows to InventoryMaterialItem on material category", () => {
    const item: InventoryItemDefinition = {
      id: "item_test_mat",
      name: "Test Material",
      category: "material",
      rarity: "common",
      tags: [],
      quantity: 1
    };

    if (item.category === "material") {
      expect(item.quantity).toBe(1);
    } else {
      fail("Expected material category");
    }
  });
});
