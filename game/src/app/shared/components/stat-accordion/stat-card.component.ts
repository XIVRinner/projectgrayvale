import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import type {
  StatAccordionItem,
  StatAccordionVariant,
} from "./stat-accordion.types";
import {
  formatCompactStatValue,
  formatLongStatValue,
} from "../../utils/stat-value-format";

@Component({
  selector: "gv-stat-card",
  standalone: true,
  imports: [TooltipModule],
  templateUrl: "./stat-card.component.html",
  styleUrl: "./stat-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly item = input.required<StatAccordionItem>();
  readonly variant = input.required<StatAccordionVariant>();

  protected readonly compactValue = computed(() =>
    formatCompactStatValue(this.item().value),
  );
  protected readonly tooltipText = computed(() =>
    this.item().isLocked
      ? `${this.item().label} locked`
      : `${this.item().label} ${formatLongStatValue(this.item().value)}`,
  );
  protected readonly ariaLabel = computed(() =>
    this.item().isLocked
      ? `${this.item().label} locked`
      : `${this.item().label} ${formatLongStatValue(this.item().value)}`,
  );
}
