import {
  sampleEquipmentItem,
  sampleInventoryItems,
  sampleJunkItem,
  sampleLegendaryMaterial,
  sampleMaterialItem,
  sampleQuestItem
} from "../examples";
import {
  inventoryEquipmentItemSchema,
  inventoryItemDefinitionSchema,
  inventoryJunkItemSchema,
  inventoryMaterialItemSchema,
  inventoryQuestItemSchema,
  materialQualitySchema
} from "../schemas";

describe("materialQualitySchema", () => {
  it("accepts values 1 through 5", () => {
    for (const q of [1, 2, 3, 4, 5]) {
      expect(materialQualitySchema.parse(q)).toBe(q);
    }
  });

  it("rejects 0", () => {
    expect(() => materialQualitySchema.parse(0)).toThrow();
  });

  it("rejects 6", () => {
    expect(() => materialQualitySchema.parse(6)).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => materialQualitySchema.parse(2.5)).toThrow();
  });
});

describe("inventoryEquipmentItemSchema", () => {
  it("accepts a valid equipment item", () => {
    expect(inventoryEquipmentItemSchema.parse(sampleEquipmentItem)).toEqual(
      sampleEquipmentItem
    );
  });

  it("accepts an equipment item without optional fields", () => {
    const input = {
      id: "item_boots_basic",
      name: "Basic Boots",
      category: "equipment",
      rarity: "common",
      tags: [],
      slot: "boots",
      itemLevel: 1
    };

    expect(inventoryEquipmentItemSchema.parse(input)).toEqual(input);
  });

  it("rejects itemLevel below 1", () => {
    expect(() =>
      inventoryEquipmentItemSchema.parse({ ...sampleEquipmentItem, itemLevel: 0 })
    ).toThrow();
  });

  it("rejects an unknown slot", () => {
    expect(() =>
      inventoryEquipmentItemSchema.parse({ ...sampleEquipmentItem, slot: "back" })
    ).toThrow();
  });

  it("rejects unknown extra fields", () => {
    expect(() =>
      inventoryEquipmentItemSchema.parse({ ...sampleEquipmentItem, unknownField: true })
    ).toThrow();
  });

  it("rejects wrong category literal", () => {
    expect(() =>
      inventoryEquipmentItemSchema.parse({ ...sampleEquipmentItem, category: "junk" })
    ).toThrow();
  });
});

describe("inventoryMaterialItemSchema", () => {
  it("accepts a valid material with quality stars", () => {
    expect(inventoryMaterialItemSchema.parse(sampleMaterialItem)).toEqual(
      sampleMaterialItem
    );
  });

  it("accepts a legendary material without quality stars", () => {
    expect(inventoryMaterialItemSchema.parse(sampleLegendaryMaterial)).toEqual(
      sampleLegendaryMaterial
    );
  });

  it("accepts quantity of 0", () => {
    const input = { ...sampleMaterialItem, quantity: 0 };

    expect(inventoryMaterialItemSchema.parse(input)).toEqual(input);
  });

  it("rejects negative quantity", () => {
    expect(() =>
      inventoryMaterialItemSchema.parse({ ...sampleMaterialItem, quantity: -1 })
    ).toThrow();
  });

  it("rejects invalid quality stars value", () => {
    expect(() =>
      inventoryMaterialItemSchema.parse({ ...sampleMaterialItem, qualityStars: 6 })
    ).toThrow();
  });

  it("rejects unknown extra fields", () => {
    expect(() =>
      inventoryMaterialItemSchema.parse({ ...sampleMaterialItem, extraField: "x" })
    ).toThrow();
  });
});

describe("inventoryQuestItemSchema", () => {
  it("accepts a valid quest item", () => {
    expect(inventoryQuestItemSchema.parse(sampleQuestItem)).toEqual(
      sampleQuestItem
    );
  });

  it("accepts all valid designation values", () => {
    for (const designation of ["temporal", "secret", "special"] as const) {
      const input = { ...sampleQuestItem, designation };

      expect(inventoryQuestItemSchema.parse(input).designation).toBe(designation);
    }
  });

  it("rejects an empty questContext", () => {
    expect(() =>
      inventoryQuestItemSchema.parse({ ...sampleQuestItem, questContext: "" })
    ).toThrow();
  });

  it("rejects an invalid designation value", () => {
    expect(() =>
      inventoryQuestItemSchema.parse({ ...sampleQuestItem, designation: "unknown" })
    ).toThrow();
  });

  it("rejects missing usable field", () => {
    const { usable: _, ...rest } = sampleQuestItem;

    expect(() => inventoryQuestItemSchema.parse(rest)).toThrow();
  });

  it("rejects unknown extra fields", () => {
    expect(() =>
      inventoryQuestItemSchema.parse({ ...sampleQuestItem, extra: true })
    ).toThrow();
  });
});

describe("inventoryJunkItemSchema", () => {
  it("accepts a valid junk item with sell value", () => {
    expect(inventoryJunkItemSchema.parse(sampleJunkItem)).toEqual(sampleJunkItem);
  });

  it("accepts a junk item without sell value", () => {
    const input = {
      id: "junk_pebble",
      name: "Smooth Pebble",
      category: "junk",
      rarity: "trash",
      tags: []
    };

    expect(inventoryJunkItemSchema.parse(input)).toEqual(input);
  });

  it("accepts sell value of 0", () => {
    const input = { ...sampleJunkItem, sellValue: 0 };

    expect(inventoryJunkItemSchema.parse(input)).toEqual(input);
  });

  it("rejects negative sell value", () => {
    expect(() =>
      inventoryJunkItemSchema.parse({ ...sampleJunkItem, sellValue: -5 })
    ).toThrow();
  });

  it("rejects unknown extra fields", () => {
    expect(() =>
      inventoryJunkItemSchema.parse({ ...sampleJunkItem, extra: true })
    ).toThrow();
  });
});

describe("inventoryItemDefinitionSchema discriminated union", () => {
  it("accepts all sample inventory items", () => {
    for (const item of sampleInventoryItems) {
      expect(inventoryItemDefinitionSchema.parse(item)).toEqual(item);
    }
  });

  it("rejects an unknown category", () => {
    expect(() =>
      inventoryItemDefinitionSchema.parse({
        id: "item_unknown",
        name: "Unknown",
        category: "consumable",
        rarity: "common",
        tags: []
      })
    ).toThrow();
  });

  it("routes equipment items to the equipment branch", () => {
    const result = inventoryItemDefinitionSchema.parse(sampleEquipmentItem);

    expect(result.category).toBe("equipment");
    if (result.category === "equipment") {
      expect(result.slot).toBe("main_hand");
    }
  });

  it("routes material items to the material branch", () => {
    const result = inventoryItemDefinitionSchema.parse(sampleMaterialItem);

    expect(result.category).toBe("material");
    if (result.category === "material") {
      expect(result.quantity).toBe(10);
    }
  });

  it("routes quest items to the quest_item branch", () => {
    const result = inventoryItemDefinitionSchema.parse(sampleQuestItem);

    expect(result.category).toBe("quest_item");
    if (result.category === "quest_item") {
      expect(result.questContext).toBe("quest_the_silent_road");
    }
  });

  it("routes junk items to the junk branch", () => {
    const result = inventoryItemDefinitionSchema.parse(sampleJunkItem);

    expect(result.category).toBe("junk");
    if (result.category === "junk") {
      expect(result.sellValue).toBe(1);
    }
  });
});
