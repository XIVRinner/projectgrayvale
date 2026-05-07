import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { RARITY_DEFINITIONS, type InventoryItemDefinition } from "@rinner/grayvale-core";

import type { ItemTooltipVariant } from "./item-tooltip.types";
import { EquipmentTooltipBodyComponent } from "./sub-pieces/equipment-tooltip-body.component";
import { MaterialTooltipBodyComponent } from "./sub-pieces/material-tooltip-body.component";
import { QuestTooltipBodyComponent } from "./sub-pieces/quest-tooltip-body.component";
import { JunkTooltipBodyComponent } from "./sub-pieces/junk-tooltip-body.component";

@Component({
  selector: "gv-item-tooltip",
  standalone: true,
  imports: [
    EquipmentTooltipBodyComponent,
    MaterialTooltipBodyComponent,
    QuestTooltipBodyComponent,
    JunkTooltipBodyComponent
  ],
  templateUrl: "./item-tooltip.component.html",
  styleUrls: ["./item-tooltip.component.scss", "./item-tooltip.variants.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemTooltipComponent {
  readonly item = input.required<InventoryItemDefinition>();

  protected readonly variant = computed((): ItemTooltipVariant => {
    switch (this.item().category) {
      case "equipment":
        return "equipment";
      case "material":
        return "material";
      case "quest_item":
        return "quest";
      case "junk":
        return "junk";
    }
  });

  protected readonly rarityColor = computed(
    (): string => RARITY_DEFINITIONS[this.item().rarity]?.color ?? "#9CA3AF"
  );

  protected readonly rarityName = computed(
    (): string => RARITY_DEFINITIONS[this.item().rarity]?.name ?? this.item().rarity
  );

  protected readonly equipmentItem = computed(() => {
    const item = this.item();
    return item.category === "equipment" ? item : null;
  });

  protected readonly materialItem = computed(() => {
    const item = this.item();
    return item.category === "material" ? item : null;
  });

  protected readonly questItem = computed(() => {
    const item = this.item();
    return item.category === "quest_item" ? item : null;
  });

  protected readonly junkItem = computed(() => {
    const item = this.item();
    return item.category === "junk" ? item : null;
  });
}
