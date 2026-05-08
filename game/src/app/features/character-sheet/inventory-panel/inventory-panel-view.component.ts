import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";

import type { EquipmentSlot } from "@rinner/grayvale-core";

import {
  INVENTORY_CATEGORY_ICONS,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_CATEGORY_ORDER,
  type InventoryEquipEvent,
  type InventoryPanelCategory,
  type InventoryPanelItemView
} from "./inventory-panel.types";
import { buildCategoryCounts, filterInventoryItems } from "./inventory-panel.utils";
import { InventoryItemComponent } from "./sub-pieces/inventory-item.component";

type InventorySectionCategory = Exclude<InventoryPanelCategory, "all">;

interface InventorySectionView {
  readonly category: InventorySectionCategory;
  readonly items: readonly InventoryPanelItemView[];
}

@Component({
  selector: "gv-inventory-panel-view",
  standalone: true,
  imports: [InventoryItemComponent],
  templateUrl: "./inventory-panel-view.component.html",
  styleUrl: "./inventory-panel-view.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryPanelViewComponent {
  readonly items = input.required<readonly InventoryPanelItemView[]>();
  readonly activeComparedItemId = input.required<string | null>();
  readonly isLoading = input.required<boolean>();
  readonly error = input.required<string | null>();

  readonly itemEquipped = output<InventoryEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();
  readonly compareItemChanged = output<string | null>();

  protected readonly categoryOrder = INVENTORY_CATEGORY_ORDER;
  protected readonly categoryLabels = INVENTORY_CATEGORY_LABELS;
  protected readonly categoryIcons = INVENTORY_CATEGORY_ICONS;
  protected readonly activeCategory = signal<InventoryPanelCategory>("all");
  protected readonly searchTerm = signal("");
  protected readonly openSections = signal<Partial<Record<InventorySectionCategory, boolean>>>({});

  protected readonly equipTooltip = (item: InventoryPanelItemView): string =>
    item.canEquip ? "Equip to active loadout" : item.equipDisabledReason ?? "Cannot equip";

  protected readonly categoryCounts = computed(() => buildCategoryCounts(this.items()));
  private readonly searchFilteredItems = computed(() =>
    filterInventoryItems(this.items(), "all", this.searchTerm().trim().toLowerCase())
  );

  protected readonly sections = computed<readonly InventorySectionView[]>(() => {
    const activeCategory = this.activeCategory();
    const categoryOrder = activeCategory === "all" ? CATEGORY_SECTIONS : [activeCategory];
    const searchFilteredItems = this.searchFilteredItems();

    return categoryOrder
      .map((category) => ({
        category,
        items: searchFilteredItems.filter((item) => item.category === category)
      }))
      .filter((section) => section.items.length > 0);
  });

  protected onCategoryChanged(category: InventoryPanelCategory): void {
    this.activeCategory.set(category);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  protected toggleSection(category: InventorySectionCategory): void {
    this.openSections.update((state) => ({
      ...state,
      [category]: !(state[category] ?? true)
    }));
  }

  protected isSectionOpen(category: InventorySectionCategory): boolean {
    return this.openSections()[category] ?? true;
  }
}

const CATEGORY_SECTIONS: readonly InventorySectionCategory[] = [
  "equipment",
  "material",
  "quest_item",
  "junk"
];
