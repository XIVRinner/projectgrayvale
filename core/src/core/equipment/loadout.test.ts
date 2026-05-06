import {
  compareItemAgainstSlot,
  createLoadout,
  equipItem,
  renameLoadout,
  selectActiveLoadout,
  unequipItem
} from "./loadout";
import type { Loadout } from "./loadout.types";

const makeLoadout = (overrides: Partial<Loadout> = {}): Loadout => ({
  id: "loadout_test",
  displayName: "Test Loadout",
  slots: {},
  isActive: false,
  ...overrides
});

describe("createLoadout", () => {
  it("creates a loadout with empty slots and inactive state", () => {
    const loadout = createLoadout("loadout_1", "Primary");

    expect(loadout.id).toBe("loadout_1");
    expect(loadout.displayName).toBe("Primary");
    expect(loadout.slots).toEqual({});
    expect(loadout.isActive).toBe(false);
    expect(loadout.notes).toBeUndefined();
  });

  it("creates a loadout with optional notes", () => {
    const loadout = createLoadout("loadout_2", "Utility", "Used for gathering");

    expect(loadout.notes).toBe("Used for gathering");
  });
});

describe("renameLoadout", () => {
  it("returns a new loadout with the updated display name", () => {
    const loadout = makeLoadout({ displayName: "Old Name" });
    const renamed = renameLoadout(loadout, "New Name");

    expect(renamed.displayName).toBe("New Name");
    expect(renamed.id).toBe(loadout.id);
  });

  it("does not mutate the original loadout", () => {
    const loadout = makeLoadout({ displayName: "Old Name" });

    renameLoadout(loadout, "New Name");

    expect(loadout.displayName).toBe("Old Name");
  });
});

describe("selectActiveLoadout", () => {
  const loadouts: Record<string, Loadout> = {
    loadout_a: makeLoadout({ id: "loadout_a", isActive: true }),
    loadout_b: makeLoadout({ id: "loadout_b", isActive: false }),
    loadout_c: makeLoadout({ id: "loadout_c", isActive: false })
  };

  it("sets only the target loadout as active", () => {
    const result = selectActiveLoadout(loadouts, "loadout_b");

    expect(result["loadout_a"].isActive).toBe(false);
    expect(result["loadout_b"].isActive).toBe(true);
    expect(result["loadout_c"].isActive).toBe(false);
  });

  it("does not mutate the original record", () => {
    selectActiveLoadout(loadouts, "loadout_b");

    expect(loadouts["loadout_a"].isActive).toBe(true);
    expect(loadouts["loadout_b"].isActive).toBe(false);
  });
});

describe("equipItem", () => {
  it("assigns an item id to the given slot", () => {
    const loadout = makeLoadout();
    const updated = equipItem(loadout, "main_hand", "item_iron_sword");

    expect(updated.slots.main_hand).toBe("item_iron_sword");
  });

  it("replaces an existing item in the slot", () => {
    const loadout = makeLoadout({ slots: { main_hand: "item_old_sword" } });
    const updated = equipItem(loadout, "main_hand", "item_new_sword");

    expect(updated.slots.main_hand).toBe("item_new_sword");
  });

  it("does not affect other slots", () => {
    const loadout = makeLoadout({ slots: { head: "item_helm" } });
    const updated = equipItem(loadout, "chest", "item_chest_piece");

    expect(updated.slots.head).toBe("item_helm");
    expect(updated.slots.chest).toBe("item_chest_piece");
  });

  it("does not mutate the original loadout", () => {
    const loadout = makeLoadout();

    equipItem(loadout, "main_hand", "item_iron_sword");

    expect(loadout.slots.main_hand).toBeUndefined();
  });
});

describe("unequipItem", () => {
  it("removes an item from the given slot", () => {
    const loadout = makeLoadout({ slots: { main_hand: "item_iron_sword" } });
    const updated = unequipItem(loadout, "main_hand");

    expect(updated.slots.main_hand).toBeUndefined();
  });

  it("is a no-op when the slot is already empty", () => {
    const loadout = makeLoadout();
    const updated = unequipItem(loadout, "ring");

    expect(updated.slots.ring).toBeUndefined();
    expect(updated).not.toBe(loadout);
  });

  it("does not affect other slots", () => {
    const loadout = makeLoadout({ slots: { head: "item_helm", chest: "item_chest" } });
    const updated = unequipItem(loadout, "head");

    expect(updated.slots.head).toBeUndefined();
    expect(updated.slots.chest).toBe("item_chest");
  });

  it("does not mutate the original loadout", () => {
    const loadout = makeLoadout({ slots: { main_hand: "item_iron_sword" } });

    unequipItem(loadout, "main_hand");

    expect(loadout.slots.main_hand).toBe("item_iron_sword");
  });
});

describe("compareItemAgainstSlot", () => {
  it("returns the current and proposed item ids", () => {
    const loadout = makeLoadout({ slots: { main_hand: "item_old_sword" } });
    const result = compareItemAgainstSlot(loadout, "main_hand", "item_new_sword");

    expect(result.slot).toBe("main_hand");
    expect(result.currentItemId).toBe("item_old_sword");
    expect(result.proposedItemId).toBe("item_new_sword");
  });

  it("returns undefined for currentItemId when the slot is empty", () => {
    const loadout = makeLoadout();
    const result = compareItemAgainstSlot(loadout, "ring", "item_ring_fire");

    expect(result.currentItemId).toBeUndefined();
    expect(result.proposedItemId).toBe("item_ring_fire");
  });

  it("returns undefined for isUpgrade as stat comparison is out of scope", () => {
    const loadout = makeLoadout({ slots: { head: "item_helm_old" } });
    const result = compareItemAgainstSlot(loadout, "head", "item_helm_new");

    expect(result.isUpgrade).toBeUndefined();
  });
});
