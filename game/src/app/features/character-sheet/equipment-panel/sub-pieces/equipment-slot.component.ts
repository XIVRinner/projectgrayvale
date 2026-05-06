import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import { RARITY_DEFINITIONS, type EquipmentSlot } from "@rinner/grayvale-core";

import type { EquipmentSlotView } from "../equipment-panel.types";

@Component({
  selector: "gv-equipment-slot",
  standalone: true,
  imports: [TooltipModule],
  templateUrl: "./equipment-slot.component.html",
  styleUrl: "./equipment-slot.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentSlotComponent {
  readonly slot = input.required<EquipmentSlotView>();

  readonly tooltipRequested = output<EquipmentSlot>();
  readonly compareRequested = output<EquipmentSlot>();

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

  protected readonly tooltipContent = computed((): string => {
    const slot = this.slot();
    const item = slot.item;
    if (!item) return `${slot.slotLabel} — empty`;

    const lines: string[] = [
      `${item.name}  [ilvl ${item.itemLevel}]`,
      RARITY_DEFINITIONS[item.rarity]?.name ?? item.rarity,
      ...(item.specialRarity ? [`Special: ${item.specialRarity}`] : []),
      ...(item.tooltip?.statLines ?? []),
      ...(item.tooltip?.effectLines ?? []),
      ...(item.tooltip?.flavorText ? [`"${item.tooltip.flavorText}"`] : [])
    ];

    return lines.join("\n");
  });

  protected onInspect(): void {
    this.tooltipRequested.emit(this.slot().slotId);
  }

  protected onCompare(): void {
    this.compareRequested.emit(this.slot().slotId);
  }
}
