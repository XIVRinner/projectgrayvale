import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { KairosEditDialogComponent } from "../../../features/kairos-edit/kairos-edit-dialog.component";

@Component({
  selector: "gv-shell-kairos-edit-dialog",
  standalone: true,
  imports: [KairosEditDialogComponent],
  template: `
    <gv-kairos-edit-dialog [open]="open()" (closed)="closed.emit()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellKairosEditDialogComponent {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();
}
