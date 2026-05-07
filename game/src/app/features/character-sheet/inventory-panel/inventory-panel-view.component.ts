import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal
} from "@angular/core";

import type { EquipmentSlot } from "@rinner/grayvale-core";

import {
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_CATEGORY_ORDER,
  type InventoryEquipEvent,
  type InventoryPanelCategory,
  type InventoryPanelItemView
} from "./inventory-panel.types";
import { buildCategoryCounts, filterInventoryItems } from "./inventory-panel.utils";
import { InventoryItemComponent } from "./sub-pieces/inventory-item.component";

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
  protected readonly activeCategory = signal<InventoryPanelCategory>("all");
  protected readonly searchTerm = signal("");

  protected readonly categoryCounts = computed(() => buildCategoryCounts(this.items()));
  protected readonly filteredItems = computed(() =>
    filterInventoryItems(this.items(), this.activeCategory(), this.searchTerm().trim().toLowerCase())
  );

  protected onCategoryChanged(category: InventoryPanelCategory): void {
    this.activeCategory.set(category);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }
}
