import { Component, input } from "@angular/core";

import type { GameLogEntry } from "../../../core/services/game-log/log-mapper";

@Component({
  selector: "gv-shell-gameplay-log-feed-list",
  standalone: true,
  templateUrl: "./shell-gameplay-log-feed-list.component.html",
  styleUrl: "./shell-gameplay-log-feed-list.component.scss"
})
export class ShellGameplayLogFeedListComponent {
  readonly entries = input.required<readonly GameLogEntry[]>();

  protected trackEntry(index: number, _entry: GameLogEntry): number {
    return index;
  }
}
