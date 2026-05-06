import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, map, of } from "rxjs";

import {
  type EquipmentSlot,
  type InventoryEquipmentItem,
  type Loadout,
  inventoryEquipmentItemSchema,
  sampleLoadoutDefault
} from "@rinner/grayvale-core";

import { EquipmentPanelViewComponent } from "./equipment-panel-view.component";
import type { EquipmentSlotView } from "./equipment-panel.types";

/** Ordered list of equipment slots as displayed in the panel (left col, right col, interleaved). */
const PANEL_SLOTS: EquipmentSlot[] = [
  "head",
  "main_hand",
  "chest",
  "off_hand",
  "gloves",
  "ring",
  "legs",
  "boots"
];

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: "Head",
  chest: "Chest",
  gloves: "Gloves",
  legs: "Legs",
  boots: "Boots",
  main_hand: "Main Hand",
  off_hand: "Off Hand",
  ring: "Ring"
};

/**
 * Smart container for the equipment panel.
 * Loads item definitions from assets, resolves the active loadout's slots,
 * and passes view-model data down to the dumb view component.
 */
@Component({
  selector: "gv-equipment-panel-container",
  standalone: true,
  imports: [EquipmentPanelViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gv-equipment-panel-view
      [slots]="slots()"
      [isLoading]="isLoading()"
      [error]="error()"
      (tooltipRequested)="onTooltipRequested($event)"
      (compareRequested)="onCompareRequested($event)"
    />
  `
})
export class EquipmentPanelContainerComponent {
  private readonly http = inject(HttpClient);

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly itemRegistry = signal<Map<string, InventoryEquipmentItem>>(new Map());

  // GAP: Active loadout from store/service
  // Blocked on: NgRx equipment slice (character-sheet store)
  // Needs: selectActiveLoadout selector and equipment feature store
  // Do not implement until: character-sheet store slice is defined
  private readonly activeLoadout = signal<Loadout>(sampleLoadoutDefault);

  protected readonly slots = computed<readonly EquipmentSlotView[]>(() => {
    const registry = this.itemRegistry();
    const loadout = this.activeLoadout();

    return PANEL_SLOTS.map((slotId) => {
      const itemId = loadout.slots[slotId];
      const item = itemId ? (registry.get(itemId) ?? null) : null;

      return {
        slotId,
        slotLabel: SLOT_LABELS[slotId],
        item,
        isCompareTarget: false
      } satisfies EquipmentSlotView;
    });
  });

  constructor() {
    this.http
      .get<unknown>("assets/data/equipment-items.json")
      .pipe(
        map((raw) => {
          const entries = Array.isArray(raw) ? raw : [];
          return entries.map((entry: unknown) => inventoryEquipmentItemSchema.parse(entry));
        }),
        catchError((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to load equipment items.";
          this.error.set(message);
          this.isLoading.set(false);
          return of([] as InventoryEquipmentItem[]);
        }),
        takeUntilDestroyed()
      )
      .subscribe((items) => {
        const registry = new Map<string, InventoryEquipmentItem>();
        for (const item of items) {
          registry.set(item.id, item);
        }
        this.itemRegistry.set(registry);
        this.isLoading.set(false);
      });
  }

  protected onTooltipRequested(slotId: EquipmentSlot): void {
    // GAP: Item tooltip overlay
    // Blocked on: design
    // Needs: a unified ItemTooltipComponent or overlay service
    // Do not implement until: ItemTooltipComponent is defined in shared/components
    console.log(`[equipment-panel] tooltip requested: ${slotId}`);
  }

  protected onCompareRequested(slotId: EquipmentSlot): void {
    // GAP: Compare item against slot
    // Blocked on: inventory panel (character-sheet MVP)
    // Needs: selectedInventoryItem emitted by InventoryPanelComponent
    // Do not implement until: InventoryPanelComponent provides a selected item signal
    console.log(`[equipment-panel] compare requested: ${slotId}`);
  }

  /** Exposed for the loadout selector to push a new active loadout (MVP wiring point). */
  setLoadout(loadout: Loadout): void {
    this.activeLoadout.set(loadout);
  }
}
