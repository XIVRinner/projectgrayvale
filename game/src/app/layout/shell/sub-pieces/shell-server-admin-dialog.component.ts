import { Component, input, output, signal } from "@angular/core";

import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-server-admin-dialog",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-server-admin-dialog.component.html",
  styleUrl: "./shell-server-admin-dialog.component.scss",
})
export class ShellServerAdminDialogComponent {
  readonly open = input.required<boolean>();
  readonly statusMessage = input<string | null>(null);
  readonly submitting = input(false);

  readonly submitted = output<string>();
  readonly closed = output<void>();

  protected readonly password = signal("");

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const password = this.password().trim();

    if (!password || this.submitting()) {
      return;
    }

    this.submitted.emit(password);
    this.password.set("");
  }
}
