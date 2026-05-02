import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import type { StatAccordionItem, StatAccordionVariant } from "./stat-accordion.types";

@Component({
  selector: "gv-stat-card",
  standalone: true,
  imports: [TooltipModule],
  templateUrl: "./stat-card.component.html",
  styleUrl: "./stat-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  readonly item = input.required<StatAccordionItem>();
  readonly variant = input.required<StatAccordionVariant>();

  protected readonly compactValue = computed(() => formatCompactNumber(this.item().value));
  protected readonly tooltipText = computed(() =>
    this.item().isLocked
      ? `${this.item().label} locked`
      : `${this.item().label} ${formatLongNumber(this.item().value)}`
  );
  protected readonly ariaLabel = computed(() =>
    this.item().isLocked
      ? `${this.item().label} locked`
      : `${this.item().label} ${formatLongNumber(this.item().value)}`
  );
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function formatLongNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}
