import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";

import { RARITY_DEFINITIONS, type EquipmentSlot } from "@rinner/grayvale-core";

import { ItemTooltipComponent } from "../../../../shared/components/item-tooltip/item-tooltip.component";
import type { EquipmentSlotView } from "../equipment-panel.types";

@Component({
  selector: "gv-equipment-slot",
  standalone: true,
  imports: [ItemTooltipComponent],
  templateUrl: "./equipment-slot.component.html",
  styleUrl: "./equipment-slot.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentSlotComponent {
  readonly slot = input.required<EquipmentSlotView>();

  readonly compareRequested = output<EquipmentSlot>();

  protected readonly showTooltip = signal(false);

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

  protected onCompare(): void {
    this.compareRequested.emit(this.slot().slotId);
  }
}
