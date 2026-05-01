import { Component, computed, input, output } from "@angular/core";

import { DialogShellComponent } from "../dialog-shell/dialog-shell.component";

import { GameDialogSessionView } from "./game-dialog.types";
import { GameDialogViewComponent } from "./game-dialog-view.component";

@Component({
  selector: "gv-game-dialog",
  standalone: true,
  imports: [DialogShellComponent, GameDialogViewComponent],
  templateUrl: "./game-dialog.component.html"
})
export class GameDialogComponent {
  readonly session = input<GameDialogSessionView | null>(null);

  readonly advanceRequested = output<void>();
  readonly choiceSelected = output<number>();

  protected readonly isOpen = computed(() => this.session() !== null);
}
