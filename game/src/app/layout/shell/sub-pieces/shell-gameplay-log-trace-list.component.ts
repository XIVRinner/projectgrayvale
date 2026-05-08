import { Component, input } from "@angular/core";

import type { DebugLogEntry } from "../../../core/services/game-log/debug-log.service";

@Component({
  selector: "gv-shell-gameplay-log-trace-list",
  standalone: true,
  templateUrl: "./shell-gameplay-log-trace-list.component.html",
  styleUrl: "./shell-gameplay-log-trace-list.component.scss"
})
export class ShellGameplayLogTraceListComponent {
  readonly entries = input.required<readonly DebugLogEntry[]>();

  protected trackEntry(_index: number, entry: DebugLogEntry): string {
    return entry.id;
  }
}
