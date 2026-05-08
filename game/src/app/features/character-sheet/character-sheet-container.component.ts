import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from "@angular/core";

import {
  createLoadout,
  equipItem,
  renameLoadout,
  selectActiveLoadout,
  unequipItem,
  type EquipmentSlot,
  type Loadout
} from "@rinner/grayvale-core";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { CombatStatsContainerComponent } from "./combat-stats/combat-stats-container.component";
import { EquipmentPanelContainerComponent } from "./equipment-panel/equipment-panel-container.component";
import { InventoryPanelContainerComponent } from "./inventory-panel/inventory-panel-container.component";
import { LoadoutSelectorContainerComponent } from "./loadout-selector/loadout-selector-container.component";
import type { LoadoutEquipEvent, LoadoutRenameEvent } from "./loadout-selector/loadout-selector.types";

type CharacterSheetTab = "equipment" | "stats" | "inventory";

interface TabDef {
  id: CharacterSheetTab;
  label: string;
  icon: string;
}

const TABS: readonly TabDef[] = [
  { id: "equipment", label: "Equipment", icon: "pi-shield" },
  { id: "stats", label: "Stats", icon: "pi-chart-bar" },
  { id: "inventory", label: "Inventory", icon: "pi-briefcase" }
];

const EMPTY_LOADOUT: Loadout = {
  ...createLoadout("loadout_default", "Default"),
  isActive: true
};

/**
 * Top-level smart container for the Character Sheet feature.
 * Owns all loadout state and wires the equipment panel, combat stats, and loadout selector together.
 * Uses a tabbed layout (Equipment / Stats / Inventory) inside the character sheet dialog.
 */
@Component({
  selector: "gv-character-sheet-container",
  standalone: true,
  imports: [
    CombatStatsContainerComponent,
    EquipmentPanelContainerComponent,
    InventoryPanelContainerComponent,
    LoadoutSelectorContainerComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gv-char-sheet">
      <nav class="gv-char-sheet__tabs" role="tablist" aria-label="Character sheet sections">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            role="tab"
            class="gv-char-sheet__tab"
            [class.gv-char-sheet__tab--active]="activeTab() === tab.id"
            [attr.aria-selected]="activeTab() === tab.id"
            [attr.aria-controls]="'gv-cs-pane-' + tab.id"
            (click)="activeTab.set(tab.id)"
          >
            <i [class]="'pi ' + tab.icon" aria-hidden="true"></i>
            {{ tab.label }}
          </button>
        }
      </nav>

      <div class="gv-char-sheet__pane" role="tabpanel" [id]="'gv-cs-pane-' + activeTab()">
        @switch (activeTab()) {
          @case ('equipment') {
            <div class="gv-char-sheet__equipment-pane">
              <gv-loadout-selector-container
                [loadoutsRecord]="loadoutsRecord()"
                [activeLoadoutId]="activeLoadoutId()"
                [player]="activeCharacter()"
                (loadoutSelected)="onLoadoutSelected($event)"
                (loadoutCreated)="onLoadoutCreated()"
                (loadoutRenamed)="onLoadoutRenamed($event)"
                (itemEquipped)="onItemEquipped($event)"
                (itemUnequipped)="onItemUnequipped($event)"
              />
              <gv-equipment-panel-container
                [activeLoadout]="activeLoadout()"
                [player]="activeCharacter()"
                [comparedItemId]="comparedItemId()"
                (compareItemChanged)="onComparedItemChanged($event)"
              />
            </div>
          }
          @case ('stats') {
            <gv-combat-stats-container
              [player]="activeCharacter()"
              [health]="activeHealth()"
              [statUnlocks]="activeSlot()?.statUnlocks ?? null"
              [activeLoadout]="activeLoadout()"
            />
          }
          @case ('inventory') {
            <gv-inventory-panel-container
              [activeLoadout]="activeLoadout()"
              [comparedItemId]="comparedItemId()"
              [player]="activeCharacter()"
              (itemEquipped)="onItemEquipped($event)"
              (itemUnequipped)="onItemUnequipped($event)"
              (compareItemChanged)="onComparedItemChanged($event)"
            />
          }
        }
      </div>
    </div>
  `,
  styleUrl: "./character-sheet-container.component.scss"
})
export class CharacterSheetContainerComponent {
  private readonly roster = inject(CharacterRosterService);

  protected readonly tabs = TABS;
  protected readonly activeTab = signal<CharacterSheetTab>("equipment");

  protected readonly activeCharacter = this.roster.activeCharacter;
  protected readonly activeHealth = this.roster.activeHealth;
  protected readonly activeSlot = this.roster.activeSlot;
  protected readonly loadoutsRecord = computed<Readonly<Record<string, Loadout>>>(() =>
    this.activeCharacter()?.loadouts ?? { [EMPTY_LOADOUT.id]: EMPTY_LOADOUT }
  );
  protected readonly activeLoadoutId = computed<string>(
    () => this.activeCharacter()?.activeLoadoutId ?? EMPTY_LOADOUT.id
  );
  protected readonly comparedItemId = signal<string | null>(null);

  protected readonly activeLoadout = computed<Loadout>(() => {
    const record = this.loadoutsRecord();
    const id = this.activeLoadoutId();
    return record[id] ?? Object.values(record)[0] ?? EMPTY_LOADOUT;
  });

  protected onLoadoutSelected(id: string): void {
    this.roster.updateActiveCharacter((player) => ({
      ...player,
      loadouts: selectActiveLoadout(
        cloneLoadouts(player.loadouts ?? { [EMPTY_LOADOUT.id]: EMPTY_LOADOUT }),
        id
      ),
      activeLoadoutId: id
    }));
    this.comparedItemId.set(null);
  }

  protected onLoadoutCreated(): void {
    this.roster.updateActiveCharacter((player) => {
      const loadouts = cloneLoadouts(player.loadouts ?? { [EMPTY_LOADOUT.id]: EMPTY_LOADOUT });
      const id = buildNextLoadoutId(loadouts);
      const nextIndex = Object.keys(loadouts).length + 1;

      return {
        ...player,
        loadouts: {
          ...loadouts,
          [id]: createLoadout(id, `Loadout ${nextIndex}`)
        }
      };
    });
  }

  protected onLoadoutRenamed(event: LoadoutRenameEvent): void {
    this.roster.updateActiveCharacter((player) => {
      const record = cloneLoadouts(player.loadouts ?? { [EMPTY_LOADOUT.id]: EMPTY_LOADOUT });
      const target = record[event.id];

      if (!target) {
        return player;
      }

      return {
        ...player,
        loadouts: {
          ...record,
          [event.id]: renameLoadout(target, event.displayName)
        }
      };
    });
  }

  protected onItemEquipped(event: LoadoutEquipEvent): void {
    this.roster.updateActiveCharacter((player) => {
      const record = cloneLoadouts(player.loadouts ?? { [EMPTY_LOADOUT.id]: EMPTY_LOADOUT });
      const activeId = player.activeLoadoutId ?? EMPTY_LOADOUT.id;
      const target = record[activeId];

      if (!target) {
        return player;
      }

      return {
        ...player,
        loadouts: {
          ...record,
          [activeId]: equipItem(target, event.slot, event.itemId)
        }
      };
    });
    this.comparedItemId.set(null);
  }

  protected onItemUnequipped(slot: EquipmentSlot): void {
    this.roster.updateActiveCharacter((player) => {
      const record = cloneLoadouts(player.loadouts ?? { [EMPTY_LOADOUT.id]: EMPTY_LOADOUT });
      const activeId = player.activeLoadoutId ?? EMPTY_LOADOUT.id;
      const target = record[activeId];

      if (!target) {
        return player;
      }

      return {
        ...player,
        loadouts: {
          ...record,
          [activeId]: unequipItem(target, slot)
        }
      };
    });
    this.comparedItemId.set(null);
  }

  protected onComparedItemChanged(itemId: string | null): void {
    this.comparedItemId.set(itemId);
  }
}

function cloneLoadouts(loadouts: Readonly<Record<string, Loadout>>): Record<string, Loadout> {
  return Object.fromEntries(
    Object.entries(loadouts).map(([id, loadout]) => [
      id,
      {
        ...loadout,
        slots: { ...loadout.slots }
      }
    ])
  );
}

function buildNextLoadoutId(loadouts: Readonly<Record<string, Loadout>>): string {
  let index = Object.keys(loadouts).length + 1;

  while (loadouts[`loadout_custom_${index}`]) {
    index += 1;
  }

  return `loadout_custom_${index}`;
}
