import { sampleLoadoutDefault, sampleLoadoutUtility, sampleLoadouts } from "../examples";
import { loadoutSchema, loadoutsRecordSchema, loadoutSlotMapSchema } from "../schemas";

describe("loadoutSlotMapSchema", () => {
  it("accepts an empty slot map", () => {
    expect(loadoutSlotMapSchema.parse({})).toEqual({});
  });

  it("accepts a partial slot map with valid item ids", () => {
    const input = {
      main_hand: "weapon_iron_sword",
      head: "armor_iron_helm"
    };

    expect(loadoutSlotMapSchema.parse(input)).toEqual(input);
  });

  it("accepts all eight MVP slots", () => {
    const input = {
      head: "item_a",
      chest: "item_b",
      gloves: "item_c",
      legs: "item_d",
      boots: "item_e",
      main_hand: "item_f",
      off_hand: "item_g",
      ring: "item_h"
    };

    expect(loadoutSlotMapSchema.parse(input)).toEqual(input);
  });

  it("rejects unknown slot keys", () => {
    expect(() => loadoutSlotMapSchema.parse({ body: "item_x" })).toThrow();
  });
});

describe("loadoutSchema", () => {
  it("accepts a valid active loadout with slots", () => {
    expect(loadoutSchema.parse(sampleLoadoutDefault)).toEqual(sampleLoadoutDefault);
  });

  it("accepts a valid inactive loadout with notes", () => {
    expect(loadoutSchema.parse(sampleLoadoutUtility)).toEqual(sampleLoadoutUtility);
  });

  it("accepts a loadout with empty slots", () => {
    const input = {
      id: "loadout_empty",
      displayName: "Empty",
      slots: {},
      isActive: false
    };

    expect(loadoutSchema.parse(input)).toEqual(input);
  });

  it("rejects an empty displayName", () => {
    expect(() =>
      loadoutSchema.parse({ ...sampleLoadoutDefault, displayName: "" })
    ).toThrow();
  });

  it("rejects a missing isActive field", () => {
    const { isActive: _, ...rest } = sampleLoadoutDefault;

    expect(() => loadoutSchema.parse(rest)).toThrow();
  });

  it("rejects unknown extra fields", () => {
    expect(() =>
      loadoutSchema.parse({ ...sampleLoadoutDefault, extra: true })
    ).toThrow();
  });
});

describe("loadoutsRecordSchema", () => {
  it("accepts a record of loadouts keyed by id", () => {
    expect(loadoutsRecordSchema.parse(sampleLoadouts)).toEqual(sampleLoadouts);
  });

  it("accepts an empty record", () => {
    expect(loadoutsRecordSchema.parse({})).toEqual({});
  });
});
