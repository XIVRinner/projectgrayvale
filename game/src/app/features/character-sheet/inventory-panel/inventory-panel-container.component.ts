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
  compareItemAgainstSlot,
  type EquipmentSlot,
  type Loadout,
  type Player,
  sampleLoadoutDefault
} from "@rinner/grayvale-core";

import {
  buildEquipmentRequirementStatuses,
  checkEquipmentRequirements
} from "../character-sheet-equipment-requirements";
import { DefinitionImageService } from "../../../data/definition-image.service";
import type { GameInventoryItemDefinition } from "../../../data/definition-parsers";
import { DefinitionRepositoryService } from "../../../data/definition-repository.service";
import type { InventoryEquipEvent, InventoryPanelItemView } from "./inventory-panel.types";
import { isEquipmentItem } from "./inventory-panel.types";
import { InventoryPanelViewComponent } from "./inventory-panel-view.component";

@Component({
  selector: "gv-inventory-panel-container",
  standalone: true,
  imports: [InventoryPanelViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gv-inventory-panel-view
      [items]="items()"
      [activeComparedItemId]="comparedItemId()"
      [isLoading]="isLoading()"
      [error]="error()"
      (itemEquipped)="itemEquipped.emit($event)"
      (itemUnequipped)="itemUnequipped.emit($event)"
      (compareItemChanged)="compareItemChanged.emit($event)"
    />
  `
})
export class InventoryPanelContainerComponent {
  private readonly definitionRepository = inject(DefinitionRepositoryService);
  private readonly definitionImageService = inject(DefinitionImageService);
  private loadGeneration = 0;

  readonly activeLoadout = input<Loadout>(sampleLoadoutDefault);
  readonly comparedItemId = input<string | null>(null);
  readonly player = input<Player | null>(null);

  readonly itemEquipped = output<InventoryEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();
  readonly compareItemChanged = output<string | null>();

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly inventoryItems = signal<readonly GameInventoryItemDefinition[]>([]);

  protected readonly items = computed<readonly InventoryPanelItemView[]>(() => {
    const loadout = this.activeLoadout();
    const player = this.player();
      const registry = new Map<string, GameInventoryItemDefinition>();

    if (!player) {
      return [];
    }

    for (const item of this.inventoryItems()) {
      registry.set(item.id, item);
    }

    const ownedItemCounts = player.inventory.items;
    const visibleItemIds = Object.entries(ownedItemCounts)
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId]) => itemId);

    return visibleItemIds
      .map((itemId) => registry.get(itemId))
        .filter((item): item is GameInventoryItemDefinition => item !== undefined)
      .map((item) => {
      const ownedQuantity = ownedItemCounts[item.id] ?? 0;
      const searchTerms = [item.name, item.rarity, item.category, ...(item.tags ?? [])].map((term) =>
        term.toLowerCase()
      );

      if (item.category === "material") {
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          rarity: item.rarity,
          specialRarity: item.specialRarity,
          itemTypeLabel: "Material",
          quantity: ownedQuantity,
          qualityStars: item.qualityStars ?? null,
          itemLevel: null,
          slot: null,
          inspectTooltip: `${item.name}\n${item.rarity}\nQuantity: ${ownedQuantity}`,
          compareSummary: null,
          isEquipped: false,
          canEquip: false,
          equipDisabledReason: null,
          requirementStatuses: [],
          searchTerms,
          itemDef: item
        } satisfies InventoryPanelItemView;
      }

      if (item.category === "quest_item") {
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          rarity: item.rarity,
          specialRarity: item.specialRarity,
          itemTypeLabel: "Quest Item",
          quantity: ownedQuantity,
          qualityStars: null,
          itemLevel: null,
          slot: null,
          inspectTooltip: `${item.name}\n${item.rarity}\nContext: ${item.questContext}`,
          compareSummary: null,
          isEquipped: false,
          canEquip: false,
          equipDisabledReason: null,
          requirementStatuses: [],
          searchTerms,
          itemDef: item
        } satisfies InventoryPanelItemView;
      }

      if (item.category === "junk") {
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          rarity: item.rarity,
          specialRarity: item.specialRarity,
          itemTypeLabel: "Junk",
          quantity: ownedQuantity,
          qualityStars: null,
          itemLevel: null,
          slot: null,
          inspectTooltip: `${item.name}\n${item.rarity}\nVendor trash`,
          compareSummary: null,
          isEquipped: false,
          canEquip: false,
          equipDisabledReason: null,
          requirementStatuses: [],
          searchTerms,
          itemDef: item
        } satisfies InventoryPanelItemView;
      }

      const requirementCheck = checkEquipmentRequirements(this.player(), item);
      const requirementStatuses = buildEquipmentRequirementStatuses(this.player(), item);
      const equippedItemId = loadout.slots[item.slot];
      const equippedItem = equippedItemId ? registry.get(equippedItemId) : null;
      const comparison = compareItemAgainstSlot(loadout, item.slot, item.id);
      let compareSummary: string;

      if (!equippedItem || !isEquipmentItem(equippedItem)) {
        compareSummary = "Slot empty";
      } else if (comparison.currentItemId === comparison.proposedItemId) {
        compareSummary = "Currently equipped";
      } else {
        const delta = item.itemLevel - equippedItem.itemLevel;
        const deltaPrefix = delta > 0 ? "+" : "";
        compareSummary = `${equippedItem.name} (${deltaPrefix}${delta} ilvl)`;
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        specialRarity: item.specialRarity,
        itemTypeLabel: `Equipment - ${item.slot.replace("_", " ")}`,
        quantity: null,
        qualityStars: null,
        itemLevel: item.itemLevel,
        slot: item.slot,
        inspectTooltip: [item.name, item.rarity, `ilvl ${item.itemLevel}`, ...(item.tooltip?.statLines ?? [])].join(
          "\n"
        ),
        compareSummary,
        isEquipped: comparison.currentItemId === item.id,
        canEquip: requirementCheck.canEquip,
        equipDisabledReason: requirementCheck.reason,
        requirementStatuses,
        searchTerms,
        itemDef: item
      } satisfies InventoryPanelItemView;
    });
  });

  constructor() {
    effect(() => {
      const player = this.player();
      const itemIds = player
        ? Object.entries(player.inventory.items)
            .filter(([, quantity]) => quantity > 0)
            .map(([itemId]) => itemId)
        : [];
      void this.loadInventoryItems(itemIds);
    });
  }

  private async loadInventoryItems(itemIds: readonly string[]): Promise<void> {
    const generation = ++this.loadGeneration;
    this.error.set(null);

    if (itemIds.length === 0) {
      this.inventoryItems.set([]);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    try {
      const items = await this.definitionRepository.getItems(itemIds);
      const hydratedItems = await Promise.all(
        items.map(async (item) => ({
          ...item,
          iconPath: await this.definitionImageService.getImageUrl(
            item.category === "material" ? "materials" : "items",
            item.imageId
          )
        }))
      );

      if (generation !== this.loadGeneration) {
        return;
      }

      this.inventoryItems.set(hydratedItems);
      this.isLoading.set(false);
    } catch (err: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }

      this.error.set(err instanceof Error ? err.message : "Failed to load inventory items.");
      this.isLoading.set(false);
    }
  }
}
