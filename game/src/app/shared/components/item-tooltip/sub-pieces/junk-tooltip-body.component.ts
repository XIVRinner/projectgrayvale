import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import type { InventoryJunkItem } from "@rinner/grayvale-core";

@Component({
  selector: "gv-junk-tooltip-body",
  standalone: true,
  templateUrl: "./junk-tooltip-body.component.html",
  styleUrl: "./junk-tooltip-body.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JunkTooltipBodyComponent {
  readonly item = input.required<InventoryJunkItem>();

  protected readonly hasSellValue = computed(() => this.item().sellValue !== undefined);
}
