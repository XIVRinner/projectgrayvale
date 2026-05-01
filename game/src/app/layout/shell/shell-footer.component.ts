// GAP: TranslocoPipe / TranslocoService not yet wired in new game.
//      Tip strings are hardcoded. Replace with transloco keys when i18n is introduced.
// GAP: ChangelogModalService, WikiModalService, DevModeService, DevEditorModalService
//      do not exist in the new game yet. Buttons are rendered as placeholders (no-op).
//      Blocked on: design + service layer implementation.
//      Do not implement modal open logic until those services are available.

import { Component, input, signal } from "@angular/core";

const TIPS: readonly string[] = [
  "Zero HP is generally considered sub-optimal.",
  "Overconfidence has claimed more heroes than any enemy.",
  "Never play the knife game before a long journey.",
  "Unpaid quest rewards have a way of finding you eventually.",
  "Not every barrel is your friend.",
  "Some things are best left unburied.",
  "Save often. Regret less.",
  "Goblin diplomacy: bring snacks."
];

@Component({
  selector: "gv-shell-footer",
  standalone: true,
  templateUrl: "./shell-footer.component.html",
  styleUrl: "./shell-footer.component.scss"
})
export class ShellFooterComponent {
  readonly version = input("0.0.1");

  protected readonly tip = signal(
    TIPS[Math.floor(Math.random() * TIPS.length)]
  );
}
