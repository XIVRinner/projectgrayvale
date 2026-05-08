import { Component, input, output, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { samplePlayer, type EquipmentSlot, type Loadout, type Player } from "@rinner/grayvale-core";

import {
  CharacterRosterService,
  type CharacterStatUnlockState
} from "../../core/services/character-roster.service";
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
  readonly player = input<Player | null>(null);

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
  readonly player = input<Player | null>(null);

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
  readonly player = input<Player | null>(null);
  readonly health = input(null);
  readonly statUnlocks = input<CharacterStatUnlockState | null>(null);
  readonly activeLoadout = input.required<Loadout>();
}

class CharacterRosterServiceStub {
  readonly activeCharacter = signal<Player | null>(clonePlayer(samplePlayer));
  readonly activeHealth = signal(null);
  readonly activeSlot = signal({
    id: "slot_1",
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    player: clonePlayer(samplePlayer),
    statUnlocks: {
      attributes: {
        vitality: true,
        strength: false,
        agility: false,
        mentality: false
      },
      skills: {
        short_blade: false,
        bow: false,
        blacksmithing: false
      }
    },
    world: {
      currentLocation: "village-arkama",
      sublocations: ["chief-house"]
    },
    health: undefined
  });

  updateActiveCharacter(updater: (player: Player) => Player): void {
    this.activeCharacter.update((player) => (player ? updater(player) : player));
    this.activeSlot.update((slot) => ({
      ...slot,
      player: updater(slot.player)
    }));
  }
}

describe("CharacterSheetContainerComponent", () => {
  let roster: CharacterRosterServiceStub;

  beforeEach(async () => {
    roster = new CharacterRosterServiceStub();

    await TestBed.configureTestingModule({
      imports: [CharacterSheetContainerComponent],
      providers: [
        {
          provide: CharacterRosterService,
          useValue: roster
        }
      ]
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

  const getCombatStats = (fixture: ReturnType<typeof createFixture>) =>
    fixture.debugElement.query(By.directive(StubCombatStatsContainerComponent))
      .componentInstance as StubCombatStatsContainerComponent;

  it("switches the active loadout", () => {
    const fixture = createFixture();

    getLoadoutSelector(fixture).loadoutSelected.emit("loadout_utility");
    fixture.detectChanges();

    expect(getLoadoutSelector(fixture).activeLoadoutId()).toBe("loadout_utility");
    expect(getLoadoutSelector(fixture).loadoutsRecord().loadout_default.isActive).toBe(false);
    expect(getLoadoutSelector(fixture).loadoutsRecord().loadout_utility.isActive).toBe(true);
    expect(getEquipmentPanel(fixture).activeLoadout().id).toBe("loadout_utility");
    expect(roster.activeCharacter()?.activeLoadoutId).toBe("loadout_utility");
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
    expect(roster.activeCharacter()?.loadouts?.["loadout_utility"]?.slots.off_hand).toBe(
      "item_training_buckler"
    );
  });

  it("unequips an item from the active loadout", () => {
    const fixture = createFixture();

    getLoadoutSelector(fixture).itemUnequipped.emit("ring");
    fixture.detectChanges();

    expect(getEquipmentPanel(fixture).activeLoadout().slots.ring).toBeUndefined();
    expect(getEquipmentPanel(fixture).activeLoadout().slots.main_hand).toBe("weapon_dagger_rustleaf");
  });

  it("passes the active roster player into the combat stats container", () => {
    const fixture = createFixture();

    const tabButtons = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(".gv-char-sheet__tab");
    tabButtons[1]?.click();
    fixture.detectChanges();

    expect(getCombatStats(fixture).player()?.id).toBe(samplePlayer.id);
    expect(getCombatStats(fixture).statUnlocks()?.attributes["strength"]).toBe(false);
  });
});

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
