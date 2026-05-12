import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from "@angular/core";

import {
  type EquipmentSlot,
  type Loadout,
  type Player,
  sampleLoadoutDefault
} from "@rinner/grayvale-core";

import { DefinitionImageService } from "../../../data/definition-image.service";
import { DefinitionRepositoryService } from "../../../data/definition-repository.service";
import type { GameInventoryEquipmentItem } from "../../../data/definition-parsers";
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
  private readonly definitionRepository = inject(DefinitionRepositoryService);
  private readonly definitionImageService = inject(DefinitionImageService);
  private loadGeneration = 0;

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly itemRegistry = signal<Map<string, GameInventoryEquipmentItem>>(new Map());

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
    effect(() => {
      const loadout = this.activeLoadout();
      const comparedItemId = this.comparedItemId();
      const itemIds = dedupeItemIds([
        ...Object.values(loadout.slots),
        comparedItemId
      ]);
      void this.loadEquipmentItems(itemIds);
    });
  }

  protected onCompareRequested(slotId: EquipmentSlot): void {
    const itemId = this.activeLoadout().slots[slotId] ?? null;
    this.compareItemChanged.emit(itemId);
  }

  private async loadEquipmentItems(itemIds: readonly string[]): Promise<void> {
    const generation = ++this.loadGeneration;
    this.error.set(null);

    if (itemIds.length === 0) {
      this.itemRegistry.set(new Map());
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    try {
      const items = await this.definitionRepository.getEquipmentItems(itemIds);
      const hydratedItems = await Promise.all(
        items.map(async (item) => ({
          ...item,
          iconPath: await this.definitionImageService.getImageUrl("items", item.imageId)
        }))
      );
      const registry = new Map<string, GameInventoryEquipmentItem>();

      for (const item of hydratedItems) {
        registry.set(item.id, item);
      }

      if (generation !== this.loadGeneration) {
        return;
      }

      this.itemRegistry.set(registry);
      this.isLoading.set(false);
    } catch (err: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }

      this.error.set(err instanceof Error ? err.message : "Failed to load equipment items.");
      this.isLoading.set(false);
    }
  }
}

function dedupeItemIds(ids: readonly (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
}
