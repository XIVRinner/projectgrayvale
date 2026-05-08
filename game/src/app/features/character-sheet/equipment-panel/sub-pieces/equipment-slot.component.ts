import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import { RARITY_DEFINITIONS, type EquipmentSlot } from "@rinner/grayvale-core";

import { ItemThumbnailComponent } from "../../../../shared/components/item-thumbnail/item-thumbnail.component";
import { ItemTooltipComponent } from "../../../../shared/components/item-tooltip/item-tooltip.component";
import type { EquipmentSlotView } from "../equipment-panel.types";

@Component({
  selector: "gv-equipment-slot",
  standalone: true,
  imports: [ItemThumbnailComponent, ItemTooltipComponent, TooltipModule],
  templateUrl: "./equipment-slot.component.html",
  styleUrl: "./equipment-slot.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentSlotComponent {
  readonly slot = input.required<EquipmentSlotView>();

  readonly compareRequested = output<EquipmentSlot>();

  protected readonly showTooltip = signal(false);
  protected readonly itemIconPath = computed(() => readIconPath(this.slot().item));

  protected readonly rarityColor = computed((): string | null => {
    const item = this.slot().item;
    if (!item) return null;
    return RARITY_DEFINITIONS[item.rarity]?.color ?? null;
  });

  protected readonly rarityName = computed((): string | null => {
    const item = this.slot().item;
    if (!item) return null;
    return RARITY_DEFINITIONS[item.rarity]?.name ?? null;
  });

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

  protected onCompare(): void {
    this.compareRequested.emit(this.slot().slotId);
  }
}

function readIconPath(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  return "iconPath" in item && typeof item.iconPath === "string" ? item.iconPath : null;
}
