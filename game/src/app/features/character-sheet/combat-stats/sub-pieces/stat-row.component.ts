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
  protected readonly lockedLabel = "Locked";

  protected onSelect(): void {
    if (this.row().isLocked || this.row().isInspectable === false) {
      return;
    }

    this.selected.emit(this.row().key);
  }
}
