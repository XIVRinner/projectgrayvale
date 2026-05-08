import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, map, of } from "rxjs";

import {
  type EquipmentSlot,
  type InventoryEquipmentItem,
  type Loadout,
  type Player,
  inventoryEquipmentItemSchema,
  sampleLoadoutDefault
} from "@rinner/grayvale-core";

import { parseItemArrayWithIconPath } from "../character-sheet-item-assets";
import { buildEquipmentRequirementStatuses } from "../character-sheet-equipment-requirements";
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
      (compareRequested)="onCompareRequested($event)"
    />
  `
})
export class EquipmentPanelContainerComponent {
  private readonly http = inject(HttpClient);

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly itemRegistry = signal<Map<string, InventoryEquipmentItem>>(new Map());

  /** Active loadout provided by the parent character-sheet container. */
  readonly activeLoadout = input<Loadout>(sampleLoadoutDefault);
  readonly player = input<Player | null>(null);
  /** Selected inventory equipment item ID to compare against active slot. */
  readonly comparedItemId = input<string | null>(null);
  readonly compareItemChanged = output<string | null>();

  protected readonly slots = computed<readonly EquipmentSlotView[]>(() => {
    const registry = this.itemRegistry();
    const loadout = this.activeLoadout();
    const comparedItemId = this.comparedItemId();
    const comparedItem = comparedItemId ? (registry.get(comparedItemId) ?? null) : null;

    return PANEL_SLOTS.map((slotId) => {
      const itemId = loadout.slots[slotId];
      const item = itemId ? (registry.get(itemId) ?? null) : null;
      const isCompareTarget = comparedItem?.slot === slotId;
      let compareDeltaLabel: string | null = null;

      if (isCompareTarget && comparedItem) {
        if (!item) {
          compareDeltaLabel = `Comparing to empty slot (ilvl ${comparedItem.itemLevel})`;
        } else {
          const delta = comparedItem.itemLevel - item.itemLevel;
          const deltaPrefix = delta > 0 ? "+" : "";
          compareDeltaLabel = `${comparedItem.name} ${deltaPrefix}${delta} ilvl`;
        }
      }

      return {
        slotId,
        slotLabel: SLOT_LABELS[slotId],
        item,
        requirementStatuses: item ? buildEquipmentRequirementStatuses(this.player(), item) : [],
        isCompareTarget,
        compareDeltaLabel
      } satisfies EquipmentSlotView;
    });
  });

  constructor() {
    this.http
      .get<unknown>("assets/data/equipment-items.json")
      .pipe(
        map((raw) => parseItemArrayWithIconPath(raw, (entry) => inventoryEquipmentItemSchema.parse(entry))),
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

  protected onCompareRequested(slotId: EquipmentSlot): void {
    const itemId = this.activeLoadout().slots[slotId] ?? null;
    this.compareItemChanged.emit(itemId);
  }
}
