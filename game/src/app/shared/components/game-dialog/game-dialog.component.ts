import { Component, computed, input, output } from "@angular/core";

import { ActivityTickFeedComponent } from "../activity-tick-feed/activity-tick-feed.component";
import { DialogShellComponent } from "../dialog-shell/dialog-shell.component";
import { CombatViewComponent } from "../../../features/combat/combat-view.component";

import { GameDialogSessionView } from "./game-dialog.types";
import { GameDialogViewComponent } from "./game-dialog-view.component";

@Component({
  selector: "gv-game-dialog",
  standalone: true,
  imports: [ActivityTickFeedComponent, CombatViewComponent, DialogShellComponent, GameDialogViewComponent],
  templateUrl: "./game-dialog.component.html"
})
export class GameDialogComponent {
  readonly session = input<GameDialogSessionView | null>(null);

  readonly advanceRequested = output<void>();
  readonly choiceSelected = output<number>();
  readonly closeRequested = output<void>();

  protected readonly isOpen = computed(() => this.session() !== null);
  protected readonly dialogWidth = computed(() => {
    const session = this.session();

    if (session?.mode === "combat") {
      return "media" as const;
    }

    return "dialogue" as const;
  });
  protected readonly showCloseButton = computed(() => {
    const session = this.session();
    return session?.mode === "activity" || session?.mode === "combat";
  });
  protected readonly closeDisabled = computed(() => {
    const session = this.session();

    if (!session) {
      return false;
    }

    if (session.mode === "activity") {
      return false;
    }

    if (session.mode === "combat") {
      return session.combatEncounter?.outcomeLabel == null;
    }

    return true;
  });
}
