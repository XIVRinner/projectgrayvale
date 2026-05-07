import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { StatBreakdown } from "@rinner/grayvale-core";

@Component({
  selector: "gv-stat-breakdown-drawer",
  standalone: true,
  templateUrl: "./stat-breakdown-drawer.component.html",
  styleUrl: "./stat-breakdown-drawer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatBreakdownDrawerComponent {
  readonly breakdown = input.required<StatBreakdown>();
  readonly statLabel = input.required<string>();

  readonly closed = output<void>();

  protected onClose(): void {
    this.closed.emit();
  }
}
