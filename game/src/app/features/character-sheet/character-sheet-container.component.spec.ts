import type { Signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { EquipmentSlot, Loadout } from "@rinner/grayvale-core";

import { CharacterSheetContainerComponent } from "./character-sheet-container.component";
import type { LoadoutEquipEvent } from "./loadout-selector/loadout-selector.types";

type TestableCharacterSheetContainerComponent = CharacterSheetContainerComponent & {
  activeLoadoutId: WritableSignal<string>;
  loadoutsRecord: WritableSignal<Record<string, Loadout>>;
  comparedItemId: WritableSignal<string | null>;
  activeLoadout: Signal<Loadout>;
  onLoadoutSelected(id: string): void;
  onItemEquipped(event: LoadoutEquipEvent): void;
  onItemUnequipped(slot: EquipmentSlot): void;
  onComparedItemChanged(itemId: string | null): void;
};

describe("CharacterSheetContainerComponent", () => {
  let component: TestableCharacterSheetContainerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterSheetContainerComponent]
    }).compileComponents();

    component = TestBed.createComponent(CharacterSheetContainerComponent)
      .componentInstance as TestableCharacterSheetContainerComponent;
  });

  it("switches the active loadout", () => {
    component.onLoadoutSelected("loadout_utility");

    expect(component.activeLoadoutId()).toBe("loadout_utility");
    expect(component.activeLoadout().id).toBe("loadout_utility");
    expect(component.loadoutsRecord().loadout_default.isActive).toBe(false);
    expect(component.loadoutsRecord().loadout_utility.isActive).toBe(true);
  });

  it("equips an item into the active loadout", () => {
    component.onLoadoutSelected("loadout_utility");
    component.onComparedItemChanged("ring_bone_carved");
    component.onItemEquipped({ slot: "off_hand", itemId: "item_training_buckler" });

    expect(component.activeLoadout().slots.off_hand).toBe("item_training_buckler");
    expect(component.loadoutsRecord().loadout_default.slots.off_hand).toBeUndefined();
    expect(component.comparedItemId()).toBeNull();
  });

  it("unequips an item from the active loadout", () => {
    component.onComparedItemChanged("ring_bone_carved");
    component.onItemUnequipped("ring");

    expect(component.activeLoadout().slots.ring).toBeUndefined();
    expect(component.activeLoadout().slots.main_hand).toBe("weapon_dagger_rustleaf");
    expect(component.comparedItemId()).toBeNull();
  });
});
