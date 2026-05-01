import { Component, input, output, signal } from "@angular/core";

import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";
import { ShellConfirmDialogComponent } from "./shell-confirm-dialog.component";
import { ShellSaveSlotSummary } from "../shell.types";

type ConfirmTarget =
  | { action: "delete"; slotId: string; message: string }
  | { action: "reset"; message: string };

@Component({
  selector: "gv-shell-save-manager-modal",
  standalone: true,
  imports: [DialogShellComponent, ShellConfirmDialogComponent],
  templateUrl: "./shell-save-manager-modal.component.html",
  styleUrl: "./shell-save-manager-modal.component.scss"
})
export class ShellSaveManagerModalComponent {
  readonly open = input.required<boolean>();
  readonly slots = input.required<readonly ShellSaveSlotSummary[]>();
  readonly transferPayload = input.required<string>();
  readonly statusMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly slotLoadRequested = output<string>();
  readonly slotDeleteRequested = output<string>();
  readonly slotExportRequested = output<string>();
  readonly exportAllRequested = output<void>();
  readonly importRequested = output<void>();
  readonly resetRequested = output<void>();
  readonly transferPayloadChanged = output<string>();
  readonly characterCreationRequested = output<void>();

  protected readonly confirmTarget = signal<ConfirmTarget | null>(null);

  protected requestDelete(slot: ShellSaveSlotSummary): void {
    this.confirmTarget.set({
      action: "delete",
      slotId: slot.id,
      message: `Delete save slot for "${slot.name}"? This cannot be undone.`
    });
  }

  protected requestReset(): void {
    this.confirmTarget.set({
      action: "reset",
      message: "Delete all save slots and reset the roster? This cannot be undone."
    });
  }

  protected onConfirmed(): void {
    const target = this.confirmTarget();
    if (!target) {
      return;
    }

    if (target.action === "delete") {
      this.slotDeleteRequested.emit(target.slotId);
    } else {
      this.resetRequested.emit();
    }

    this.confirmTarget.set(null);
  }

  protected onConfirmCancelled(): void {
    this.confirmTarget.set(null);
  }

  protected stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  protected onTransferPayloadInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.transferPayloadChanged.emit(target.value);
  }
}
