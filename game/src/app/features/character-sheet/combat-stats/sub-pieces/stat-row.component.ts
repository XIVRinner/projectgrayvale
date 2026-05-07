import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { CombatStatRowView } from "../combat-stats.types";

@Component({
  selector: "gv-stat-row",
  standalone: true,
  templateUrl: "./stat-row.component.html",
  styleUrl: "./stat-row.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatRowComponent {
  readonly row = input.required<CombatStatRowView>();
  readonly isSelected = input<boolean>(false);

  readonly selected = output<string>();

  protected onSelect(): void {
    this.selected.emit(this.row().key);
  }
}
