import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import type { EquipmentSlot } from "@rinner/grayvale-core";

import { ItemThumbnailComponent } from "../../../../shared/components/item-thumbnail/item-thumbnail.component";
import { ItemTooltipComponent } from "../../../../shared/components/item-tooltip/item-tooltip.component";
import type {
  LoadoutEquipEvent,
  LoadoutSlotEquipOptionView,
  LoadoutSlotRowView
} from "../loadout-selector.types";

@Component({
  selector: "gv-loadout-slot-card",
  standalone: true,
  imports: [TooltipModule, ItemThumbnailComponent, ItemTooltipComponent],
  templateUrl: "./loadout-slot-card.component.html",
  styleUrl: "./loadout-slot-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadoutSlotCardComponent {
  readonly slot = input.required<LoadoutSlotRowView>();
  readonly options = input<readonly LoadoutSlotEquipOptionView[]>([]);

  readonly itemEquipped = output<LoadoutEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();

  protected readonly showTooltip = signal(false);

  protected readonly optionTitle = (option: LoadoutSlotEquipOptionView): string | null =>
    option.disabled ? option.disabledReason : null;
  protected readonly itemIconPath = (item: unknown): string | null => readIconPath(item);

  protected onEquipChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const itemId = select.value;

    if (!itemId) {
      return;
    }

    this.itemEquipped.emit({ slot: this.slot().slotId, itemId });
    select.value = "";
  }

  protected onTooltipHover(visible: boolean): void {
    if (!this.slot().equippedItem) {
      return;
    }

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
}

function readIconPath(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  return "iconPath" in item && typeof item.iconPath === "string" ? item.iconPath : null;
}
