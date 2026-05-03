import { Component, input, output } from "@angular/core";

import { DialogShellVariant } from "./dialog-shell.types";

@Component({
  selector: "gv-dialog-shell",
  standalone: true,
  templateUrl: "./dialog-shell.component.html",
  styleUrl: "./dialog-shell.component.scss"
})
export class DialogShellComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly eyebrow = input<string | null>(null);
  readonly subtitle = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly variant = input<DialogShellVariant>("character-system");
  readonly closeDisabled = input(false);
  readonly showCloseButton = input(true);
  readonly width = input<"standard" | "wide" | "creator" | "media" | "dialogue" | "log">(
    "standard"
  );

  readonly closed = output<void>();

  protected onOverlayClick(): void {
    if (this.closeDisabled()) {
      return;
    }

    this.closed.emit();
  }

  protected onCloseClick(): void {
    if (this.closeDisabled()) {
      return;
    }

    this.closed.emit();
  }

  protected stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
