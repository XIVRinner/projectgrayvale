import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import type { EquipmentSlot } from "@rinner/grayvale-core";

import { ItemThumbnailComponent } from "../../../../shared/components/item-thumbnail/item-thumbnail.component";
import { ItemTooltipComponent } from "../../../../shared/components/item-tooltip/item-tooltip.component";
import { toQualityStars } from "../inventory-panel.utils";
import type { InventoryEquipEvent, InventoryPanelItemView } from "../inventory-panel.types";

@Component({
  selector: "gv-inventory-item",
  standalone: true,
  imports: [TooltipModule, ItemThumbnailComponent, ItemTooltipComponent],
  templateUrl: "./inventory-item.component.html",
  styleUrl: "./inventory-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryItemComponent {
  readonly item = input.required<InventoryPanelItemView>();
  readonly isCompared = input.required<boolean>();
  readonly equipTooltip = input<string>("Equip to active loadout");

  readonly equipRequested = output<InventoryEquipEvent>();
  readonly unequipRequested = output<EquipmentSlot>();
  readonly compareRequested = output<string | null>();

  protected readonly qualityStarsLabel = computed(() => toQualityStars(this.item().qualityStars));
  protected readonly itemIconPath = computed(() => readIconPath(this.item().itemDef));
  protected readonly showTooltip = signal(false);

  protected onTooltipHover(visible: boolean): void {
    this.showTooltip.set(visible);
  }

  protected onTooltipFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget;
    const currentTarget = event.currentTarget;

    if (
      nextTarget instanceof Node &&
      currentTarget instanceof HTMLElement &&
      currentTarget.contains(nextTarget)
    ) {
      return;
    }

    this.showTooltip.set(false);
  }

  protected onEquip(): void {
    const item = this.item();
    if (!item.slot || !item.canEquip) return;
    this.equipRequested.emit({ slot: item.slot, itemId: item.id });
  }

  protected onUnequip(): void {
    const slot = this.item().slot;
    if (!slot) return;
    this.unequipRequested.emit(slot);
  }

  protected onCompareToggle(): void {
    const item = this.item();
    if (item.category !== "equipment") return;
    this.compareRequested.emit(this.isCompared() ? null : item.id);
  }
}

function readIconPath(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  return "iconPath" in item && typeof item.iconPath === "string" ? item.iconPath : null;
}
