import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import type { InventoryQuestItem } from "@rinner/grayvale-core";

@Component({
  selector: "gv-quest-tooltip-body",
  standalone: true,
  templateUrl: "./quest-tooltip-body.component.html",
  styleUrl: "./quest-tooltip-body.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuestTooltipBodyComponent {
  readonly item = input.required<InventoryQuestItem>();

  protected readonly stateLabel = computed((): string => {
    const item = this.item();
    if (item.locked) return "Locked";
    if (!item.usable) return "Not usable";
    return "Usable";
  });

  protected readonly designationLabel = computed((): string | null => {
    const d = this.item().designation;
    if (!d) return null;
    return d.charAt(0).toUpperCase() + d.slice(1);
  });

  protected readonly hasTags = computed(() => this.item().tags.length > 0);
}
