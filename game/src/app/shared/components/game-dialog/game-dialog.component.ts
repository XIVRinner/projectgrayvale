import { Component, computed, input, output } from "@angular/core";

import { ActivityTickFeedComponent } from "../activity-tick-feed/activity-tick-feed.component";
import { DialogShellComponent } from "../dialog-shell/dialog-shell.component";

import { GameDialogSessionView } from "./game-dialog.types";
import { GameDialogViewComponent } from "./game-dialog-view.component";

@Component({
  selector: "gv-game-dialog",
  standalone: true,
  imports: [ActivityTickFeedComponent, DialogShellComponent, GameDialogViewComponent],
  templateUrl: "./game-dialog.component.html"
})
export class GameDialogComponent {
  readonly session = input<GameDialogSessionView | null>(null);

  readonly advanceRequested = output<void>();
  readonly choiceSelected = output<number>();
  readonly closeRequested = output<void>();

  protected readonly isOpen = computed(() => this.session() !== null);
}
