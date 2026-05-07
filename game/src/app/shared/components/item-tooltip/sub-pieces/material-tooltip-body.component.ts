import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import type { InventoryMaterialItem } from "@rinner/grayvale-core";

@Component({
  selector: "gv-material-tooltip-body",
  standalone: true,
  templateUrl: "./material-tooltip-body.component.html",
  styleUrl: "./material-tooltip-body.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaterialTooltipBodyComponent {
  readonly item = input.required<InventoryMaterialItem>();

  protected readonly qualityStarsLabel = computed((): string => {
    const stars = this.item().qualityStars;
    return stars ? "★".repeat(stars) : "";
  });

  protected readonly hasCraftingTags = computed(
    () => (this.item().craftingTags?.length ?? 0) > 0
  );

  protected readonly hasTags = computed(() => this.item().tags.length > 0);
}
