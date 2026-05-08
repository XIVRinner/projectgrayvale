import { CharacterSheetContainerComponent } from "./character-sheet-container.component";

describe("CharacterSheetContainerComponent", () => {
  it("switches the active loadout", () => {
    const component = new CharacterSheetContainerComponent() as any;

    component.onLoadoutSelected("loadout_utility");

    expect(component.activeLoadoutId()).toBe("loadout_utility");
    expect(component.activeLoadout().id).toBe("loadout_utility");
    expect(component.loadoutsRecord().loadout_default.isActive).toBe(false);
    expect(component.loadoutsRecord().loadout_utility.isActive).toBe(true);
  });

  it("equips an item into the active loadout", () => {
    const component = new CharacterSheetContainerComponent() as any;

    component.onLoadoutSelected("loadout_utility");
    component.onComparedItemChanged("ring_bone_carved");
    component.onItemEquipped({ slot: "off_hand", itemId: "item_training_buckler" });

    expect(component.activeLoadout().slots.off_hand).toBe("item_training_buckler");
    expect(component.loadoutsRecord().loadout_default.slots.off_hand).toBeUndefined();
    expect(component.comparedItemId()).toBeNull();
  });

  it("unequips an item from the active loadout", () => {
    const component = new CharacterSheetContainerComponent() as any;

    component.onComparedItemChanged("ring_bone_carved");
    component.onItemUnequipped("ring");

    expect(component.activeLoadout().slots.ring).toBeUndefined();
    expect(component.activeLoadout().slots.main_hand).toBe("weapon_dagger_rustleaf");
    expect(component.comparedItemId()).toBeNull();
  });
});
