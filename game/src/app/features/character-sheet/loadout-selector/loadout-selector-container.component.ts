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
  type Player
} from "@rinner/grayvale-core";

import { DefinitionImageService } from "../../../data/definition-image.service";
import { DefinitionRepositoryService } from "../../../data/definition-repository.service";
import type { GameInventoryEquipmentItem } from "../../../data/definition-parsers";
import {
  buildEquipmentRequirementStatuses,
  checkEquipmentRequirements
} from "../character-sheet-equipment-requirements";
import type {
  LoadoutEquipEvent,
  LoadoutRenameEvent,
  LoadoutRowView,
  LoadoutSlotEquipOptionView,
  LoadoutSlotRowView
} from "./loadout-selector.types";
import { LoadoutSelectorViewComponent } from "./loadout-selector-view.component";

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

const ALL_SLOTS: EquipmentSlot[] = [
  "head",
  "main_hand",
  "chest",
  "off_hand",
  "gloves",
  "ring",
  "legs",
  "boots"
];

/**
 * Smart container for the loadout selector.
 * Loads the item registry, computes view models from parent-provided loadout state,
 * and forwards user actions to the parent via outputs.
 */
@Component({
  selector: "gv-loadout-selector-container",
  standalone: true,
  imports: [LoadoutSelectorViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gv-loadout-selector-view
      [loadouts]="loadoutRows()"
      [activeSlots]="activeSlots()"
      [itemsBySlot]="itemsBySlot()"
      [isLoading]="isLoading()"
      [error]="error()"
      (loadoutSelected)="loadoutSelected.emit($event)"
      (loadoutCreated)="loadoutCreated.emit()"
      (loadoutRenamed)="loadoutRenamed.emit($event)"
      (itemEquipped)="itemEquipped.emit($event)"
      (itemUnequipped)="itemUnequipped.emit($event)"
    />
  `
})
export class LoadoutSelectorContainerComponent {
  private readonly definitionRepository = inject(DefinitionRepositoryService);
  private readonly definitionImageService = inject(DefinitionImageService);
  private loadGeneration = 0;

  /** All loadouts keyed by ID — provided by the parent character-sheet container. */
  readonly loadoutsRecord = input.required<Readonly<Record<string, Loadout>>>();
  /** ID of the currently active loadout. */
  readonly activeLoadoutId = input.required<string>();
  readonly player = input<Player | null>(null);

  readonly loadoutSelected = output<string>();
  readonly loadoutCreated = output<void>();
  readonly loadoutRenamed = output<LoadoutRenameEvent>();
  readonly itemEquipped = output<LoadoutEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly itemRegistry = signal<Map<string, GameInventoryEquipmentItem>>(new Map());

  protected readonly loadoutRows = computed<readonly LoadoutRowView[]>(() => {
    const record = this.loadoutsRecord();
    return Object.values(record).map((l) => ({
      id: l.id,
      displayName: l.displayName,
      isActive: l.isActive,
      notes: l.notes
    }));
  });

  protected readonly activeSlots = computed<readonly LoadoutSlotRowView[]>(() => {
    const record = this.loadoutsRecord();
    const activeId = this.activeLoadoutId();
    const activeLoadout = record[activeId];
    const registry = this.itemRegistry();

    if (!activeLoadout) return [];

    return ALL_SLOTS.map((slotId) => {
      const itemId = activeLoadout.slots[slotId];
      const equippedItem = itemId ? (registry.get(itemId) ?? null) : null;

      return {
        slotId,
        slotLabel: SLOT_LABELS[slotId],
        equippedItem,
        requirementStatuses: equippedItem ? buildEquipmentRequirementStatuses(this.player(), equippedItem) : []
      } satisfies LoadoutSlotRowView;
    });
  });

  protected readonly itemsBySlot = computed<Readonly<Record<EquipmentSlot, readonly LoadoutSlotEquipOptionView[]>>>(() => {
    const registry = this.itemRegistry();
    const result = {} as Record<EquipmentSlot, LoadoutSlotEquipOptionView[]>;

    for (const slotId of ALL_SLOTS) {
      result[slotId] = [];
    }

    for (const item of registry.values()) {
      if (item.slot && (ALL_SLOTS as string[]).includes(item.slot)) {
        const requirementCheck = checkEquipmentRequirements(this.player(), item);

        result[item.slot as EquipmentSlot].push({
          id: item.id,
          name: item.name,
          disabled: !requirementCheck.canEquip,
          disabledReason: requirementCheck.reason
        });
      }
    }

    return result;
  });

  constructor() {
    effect(() => {
      const player = this.player();
      const loadoutItemIds = Object.values(this.loadoutsRecord())
        .flatMap((loadout) => Object.values(loadout.slots));
      const ownedItemIds = player
        ? Object.entries(player.inventory.items)
            .filter(([, quantity]) => quantity > 0)
            .map(([itemId]) => itemId)
        : [];
      void this.loadItems(dedupeItemIds([...loadoutItemIds, ...ownedItemIds]));
    });
  }

  private async loadItems(itemIds: readonly string[]): Promise<void> {
    const generation = ++this.loadGeneration;
    this.error.set(null);

    if (itemIds.length === 0) {
      this.itemRegistry.set(new Map());
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    try {
      const items = await this.definitionRepository.getItems(itemIds);
      const equipmentItems = items.filter(
        (item): item is GameInventoryEquipmentItem => item.category === "equipment"
      );
      const hydratedItems = await Promise.all(
        equipmentItems.map(async (item) => ({
          ...item,
          iconPath: await this.definitionImageService.getImageUrl(
            "items",
            item.imageId ?? null
          )
        }))
      );
      const map = new Map<string, GameInventoryEquipmentItem>();

      for (const item of hydratedItems) {
        map.set(item.id, item);
      }

      if (generation !== this.loadGeneration) {
        return;
      }

      this.itemRegistry.set(map);
      this.isLoading.set(false);
    } catch (err: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }

      this.error.set(err instanceof Error ? err.message : "Failed to load items.");
      this.isLoading.set(false);
    }
  }
}

function dedupeItemIds(ids: readonly (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
}
