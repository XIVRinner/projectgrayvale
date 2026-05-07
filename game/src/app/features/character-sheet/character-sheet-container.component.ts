import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";

import {
  createLoadout,
  equipItem,
  renameLoadout,
  selectActiveLoadout,
  sampleLoadouts,
  unequipItem,
  type EquipmentSlot,
  type Loadout
} from "@rinner/grayvale-core";

import { EquipmentPanelContainerComponent } from "./equipment-panel/equipment-panel-container.component";
import { InventoryPanelContainerComponent } from "./inventory-panel/inventory-panel-container.component";
import { LoadoutSelectorContainerComponent } from "./loadout-selector/loadout-selector-container.component";
import type { LoadoutEquipEvent, LoadoutRenameEvent } from "./loadout-selector/loadout-selector.types";

let _nextLoadoutIndex = 3;

/**
 * Top-level smart container for the Character Sheet feature.
 * Owns all loadout state and wires the equipment panel and loadout selector together.
 */
@Component({
  selector: "gv-character-sheet-container",
  standalone: true,
  imports: [EquipmentPanelContainerComponent, InventoryPanelContainerComponent, LoadoutSelectorContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gv-char-sheet">
      <gv-loadout-selector-container
        [loadoutsRecord]="loadoutsRecord()"
        [activeLoadoutId]="activeLoadoutId()"
        (loadoutSelected)="onLoadoutSelected($event)"
        (loadoutCreated)="onLoadoutCreated()"
        (loadoutRenamed)="onLoadoutRenamed($event)"
        (itemEquipped)="onItemEquipped($event)"
        (itemUnequipped)="onItemUnequipped($event)"
      />
      <gv-equipment-panel-container
        [activeLoadout]="activeLoadout()"
        [comparedItemId]="comparedItemId()"
        (compareItemChanged)="onComparedItemChanged($event)"
      />
      <gv-inventory-panel-container
        [activeLoadout]="activeLoadout()"
        [comparedItemId]="comparedItemId()"
        (itemEquipped)="onItemEquipped($event)"
        (itemUnequipped)="onItemUnequipped($event)"
        (compareItemChanged)="onComparedItemChanged($event)"
      />
    </div>
  `,
  styleUrl: "./character-sheet-container.component.scss"
})
export class CharacterSheetContainerComponent {
  protected readonly loadoutsRecord = signal<Record<string, Loadout>>({ ...sampleLoadouts });
  protected readonly activeLoadoutId = signal<string>("loadout_default");
  protected readonly comparedItemId = signal<string | null>(null);

  protected readonly activeLoadout = computed<Loadout>(() => {
    const record = this.loadoutsRecord();
    const id = this.activeLoadoutId();
    return record[id] ?? Object.values(record)[0];
  });

  protected onLoadoutSelected(id: string): void {
    const updated = selectActiveLoadout(this.loadoutsRecord(), id);
    this.loadoutsRecord.set(updated);
    this.activeLoadoutId.set(id);
    this.comparedItemId.set(null);
  }

  protected onLoadoutCreated(): void {
    const id = `loadout_custom_${_nextLoadoutIndex++}`;
    const newLoadout = createLoadout(id, `Loadout ${_nextLoadoutIndex - 1}`);
    const updated = { ...this.loadoutsRecord(), [id]: newLoadout };
    this.loadoutsRecord.set(updated);
  }

  protected onLoadoutRenamed(event: LoadoutRenameEvent): void {
    const record = this.loadoutsRecord();
    const target = record[event.id];

    if (!target) return;

    this.loadoutsRecord.set({
      ...record,
      [event.id]: renameLoadout(target, event.displayName)
    });
  }

  protected onItemEquipped(event: LoadoutEquipEvent): void {
    const record = this.loadoutsRecord();
    const activeId = this.activeLoadoutId();
    const target = record[activeId];

    if (!target) return;

    this.loadoutsRecord.set({
      ...record,
      [activeId]: equipItem(target, event.slot, event.itemId)
    });
    this.comparedItemId.set(null);
  }

  protected onItemUnequipped(slot: EquipmentSlot): void {
    const record = this.loadoutsRecord();
    const activeId = this.activeLoadoutId();
    const target = record[activeId];

    if (!target) return;

    this.loadoutsRecord.set({
      ...record,
      [activeId]: unequipItem(target, slot)
    });
    this.comparedItemId.set(null);
  }

  protected onComparedItemChanged(itemId: string | null): void {
    this.comparedItemId.set(itemId);
  }
}
