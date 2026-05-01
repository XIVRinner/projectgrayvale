import { Component, input, signal } from "@angular/core";

import { DialogShellComponent } from "../dialog-shell/dialog-shell.component";
import { DialogShellVariant } from "../dialog-shell/dialog-shell.types";

@Component({
  selector: "gv-image-preview",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./image-preview.component.html",
  styleUrl: "./image-preview.component.scss"
})
export class ImagePreviewComponent {
  readonly src = input.required<string>();
  readonly alt = input("Preview image");
  readonly title = input("Image preview");
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly triggerLabel = input<string | null>(null);
  readonly variant = input<DialogShellVariant>("reference");
  readonly width = input<"standard" | "wide" | "creator" | "media">("media");

  protected readonly isOpen = signal(false);

  protected open(): void {
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
  }
}
