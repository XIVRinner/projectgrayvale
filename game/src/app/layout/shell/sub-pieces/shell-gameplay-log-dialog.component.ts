import { Component, input, output } from "@angular/core";

import type { DebugLogEntry } from "../../../core/services/game-log/debug-log.service";
import type { GameLogEntry } from "../../../core/services/game-log/log-mapper";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-gameplay-log-dialog",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-gameplay-log-dialog.component.html",
  styleUrl: "./shell-gameplay-log-dialog.component.scss"
})
export class ShellGameplayLogDialogComponent {
  readonly open = input.required<boolean>();
  readonly entries = input.required<readonly GameLogEntry[]>();
  readonly debugEntries = input.required<readonly DebugLogEntry[]>();

  readonly closed = output<void>();

  protected trackEntry(index: number, entry: GameLogEntry): string {
    if (entry.type === "choice") {
      return `choice:${index}:${entry.options.map((option) => option.label).join("|")}`;
    }

    return `${entry.type}:${index}:${entry.text}`;
  }

  protected trackDebugEntry(_index: number, entry: DebugLogEntry): string {
    return entry.id;
  }
}
