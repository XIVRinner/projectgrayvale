import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { CombatWeaponDamageRowView } from "../combat-stats.types";

@Component({
  selector: "gv-combat-weapon-profile",
  standalone: true,
  templateUrl: "./combat-weapon-profile.component.html",
  styleUrl: "./combat-weapon-profile.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatWeaponProfileComponent {
  readonly rows = input.required<readonly CombatWeaponDamageRowView[]>();
}
