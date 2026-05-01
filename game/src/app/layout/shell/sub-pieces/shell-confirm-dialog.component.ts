import { Component, input, output } from "@angular/core";

import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-confirm-dialog",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-confirm-dialog.component.html",
  styleUrl: "./shell-confirm-dialog.component.scss"
})
export class ShellConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly message = input.required<string>();
  readonly confirmLabel = input("Confirm");
  readonly danger = input(true);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
