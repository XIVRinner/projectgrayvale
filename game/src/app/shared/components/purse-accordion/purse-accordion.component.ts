import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";

import type { ShellPursePanel } from "../../../layout/shell/shell.types";

@Component({
  selector: "gv-purse-accordion",
  standalone: true,
  templateUrl: "./purse-accordion.component.html",
  styleUrl: "./purse-accordion.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurseAccordionComponent {
  readonly purse = input.required<ShellPursePanel>();

  protected readonly isOpen = signal(true);

  protected toggle(): void {
    this.isOpen.update((open) => !open);
  }
}