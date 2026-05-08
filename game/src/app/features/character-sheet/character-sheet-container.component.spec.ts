import { Component, input, output } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type { EquipmentSlot, Loadout } from "@rinner/grayvale-core";

import { CharacterSheetContainerComponent } from "./character-sheet-container.component";
import { CombatStatsContainerComponent } from "./combat-stats/combat-stats-container.component";
import { EquipmentPanelContainerComponent } from "./equipment-panel/equipment-panel-container.component";
import { InventoryPanelContainerComponent } from "./inventory-panel/inventory-panel-container.component";
import type { InventoryEquipEvent } from "./inventory-panel/inventory-panel.types";
import { LoadoutSelectorContainerComponent } from "./loadout-selector/loadout-selector-container.component";
import type { LoadoutEquipEvent, LoadoutRenameEvent } from "./loadout-selector/loadout-selector.types";

@Component({
  selector: "gv-loadout-selector-container",
  standalone: true,
  template: ""
})
class StubLoadoutSelectorContainerComponent {
  readonly loadoutsRecord = input.required<Readonly<Record<string, Loadout>>>();
  readonly activeLoadoutId = input.required<string>();

  readonly loadoutSelected = output<string>();
  readonly loadoutCreated = output<void>();
  readonly loadoutRenamed = output<LoadoutRenameEvent>();
  readonly itemEquipped = output<LoadoutEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();
}

@Component({
  selector: "gv-equipment-panel-container",
  standalone: true,
  template: ""
})
class StubEquipmentPanelContainerComponent {
  readonly activeLoadout = input.required<Loadout>();
  readonly comparedItemId = input<string | null>(null);

  readonly compareItemChanged = output<string | null>();
}

@Component({
  selector: "gv-inventory-panel-container",
  standalone: true,
  template: ""
})
class StubInventoryPanelContainerComponent {
  readonly activeLoadout = input.required<Loadout>();
  readonly comparedItemId = input<string | null>(null);

  readonly itemEquipped = output<InventoryEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();
  readonly compareItemChanged = output<string | null>();
}

@Component({
  selector: "gv-combat-stats-container",
  standalone: true,
  template: ""
})
class StubCombatStatsContainerComponent {
  readonly activeLoadout = input.required<Loadout>();
}

describe("CharacterSheetContainerComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterSheetContainerComponent]
    })
      .overrideComponent(CharacterSheetContainerComponent, {
        remove: {
          imports: [
            CombatStatsContainerComponent,
            EquipmentPanelContainerComponent,
            InventoryPanelContainerComponent,
            LoadoutSelectorContainerComponent
          ]
        },
        add: {
          imports: [
            StubCombatStatsContainerComponent,
            StubEquipmentPanelContainerComponent,
            StubInventoryPanelContainerComponent,
            StubLoadoutSelectorContainerComponent
          ]
        }
      })
      .compileComponents();
  });

  const createFixture = () => {
    const fixture = TestBed.createComponent(CharacterSheetContainerComponent);
    fixture.detectChanges();
    return fixture;
  };

  const getLoadoutSelector = (fixture: ReturnType<typeof createFixture>) =>
    fixture.debugElement.query(By.directive(StubLoadoutSelectorContainerComponent))
      .componentInstance as StubLoadoutSelectorContainerComponent;

  const getEquipmentPanel = (fixture: ReturnType<typeof createFixture>) =>
    fixture.debugElement.query(By.directive(StubEquipmentPanelContainerComponent))
      .componentInstance as StubEquipmentPanelContainerComponent;

  it("switches the active loadout", () => {
    const fixture = createFixture();

    getLoadoutSelector(fixture).loadoutSelected.emit("loadout_utility");
    fixture.detectChanges();

    expect(getLoadoutSelector(fixture).activeLoadoutId()).toBe("loadout_utility");
    expect(getLoadoutSelector(fixture).loadoutsRecord().loadout_default.isActive).toBe(false);
    expect(getLoadoutSelector(fixture).loadoutsRecord().loadout_utility.isActive).toBe(true);
    expect(getEquipmentPanel(fixture).activeLoadout().id).toBe("loadout_utility");
  });

  it("equips an item into the active loadout", () => {
    const fixture = createFixture();
    const loadoutSelector = getLoadoutSelector(fixture);

    loadoutSelector.loadoutSelected.emit("loadout_utility");
    fixture.detectChanges();
    loadoutSelector.itemEquipped.emit({ slot: "off_hand", itemId: "item_training_buckler" });
    fixture.detectChanges();

    expect(getEquipmentPanel(fixture).activeLoadout().slots.off_hand).toBe("item_training_buckler");
    expect(getLoadoutSelector(fixture).loadoutsRecord().loadout_default.slots.off_hand).toBeUndefined();
  });

  it("unequips an item from the active loadout", () => {
    const fixture = createFixture();

    getLoadoutSelector(fixture).itemUnequipped.emit("ring");
    fixture.detectChanges();

    expect(getEquipmentPanel(fixture).activeLoadout().slots.ring).toBeUndefined();
    expect(getEquipmentPanel(fixture).activeLoadout().slots.main_hand).toBe("weapon_dagger_rustleaf");
  });
});
