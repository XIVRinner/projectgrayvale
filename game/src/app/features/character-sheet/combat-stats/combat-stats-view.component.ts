import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { StatBreakdown } from "@rinner/grayvale-core";

import type { CombatStatGroupView } from "./combat-stats.types";
import { StatRowComponent } from "./sub-pieces/stat-row.component";
import { StatBreakdownDrawerComponent } from "./sub-pieces/stat-breakdown-drawer.component";

@Component({
  selector: "gv-combat-stats-view",
  standalone: true,
  imports: [StatRowComponent, StatBreakdownDrawerComponent],
  templateUrl: "./combat-stats-view.component.html",
  styleUrl: "./combat-stats-view.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatStatsViewComponent {
  readonly statGroups = input.required<readonly CombatStatGroupView[]>();
  readonly selectedKey = input<string | null>(null);
  readonly selectedBreakdown = input<StatBreakdown | null>(null);
  readonly selectedLabel = input<string | null>(null);
  readonly isLoading = input.required<boolean>();
  readonly error = input.required<string | null>();

  readonly statSelected = output<string>();
  readonly drawerClosed = output<void>();
}
