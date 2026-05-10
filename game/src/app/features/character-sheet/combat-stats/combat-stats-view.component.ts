import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { StatBreakdown } from "@rinner/grayvale-core";

import type { CombatStatGroupView, CombatWeaponDamageRowView } from "./combat-stats.types";
import { StatRowComponent } from "./sub-pieces/stat-row.component";
import { StatBreakdownDrawerComponent } from "./sub-pieces/stat-breakdown-drawer.component";
import { CombatWeaponProfileComponent } from "./sub-pieces/combat-weapon-profile.component";

@Component({
  selector: "gv-combat-stats-view",
  standalone: true,
  imports: [StatRowComponent, StatBreakdownDrawerComponent, CombatWeaponProfileComponent],
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
  readonly weaponDamageRows = input<readonly CombatWeaponDamageRowView[]>([]);

  readonly statSelected = output<string>();
  readonly drawerClosed = output<void>();
}
