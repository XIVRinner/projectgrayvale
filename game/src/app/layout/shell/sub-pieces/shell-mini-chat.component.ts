import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { ButtonModule } from "primeng/button";

import { ShellMiniChatPanel } from "../shell.types";

@Component({
  selector: "gv-shell-mini-chat",
  standalone: true,
  imports: [ButtonModule],
  templateUrl: "./shell-mini-chat.component.html",
  styleUrl: "./shell-mini-chat.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellMiniChatComponent {
  readonly panel = input.required<ShellMiniChatPanel>();
  readonly canSend = input.required<boolean>();
  readonly isSending = input.required<boolean>();
  readonly sendHint = input<string | null>(null);
  readonly statusMessage = input<string | null>(null);

  protected readonly collapsed = signal(false);
  protected readonly draftMessage = signal("");

  readonly refreshRequested = output<void>();
  readonly openServerSelectRequested = output<void>();
  readonly openFullChatRequested = output<void>();
  readonly sendRequested = output<string>();

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  protected onDraftChanged(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.draftMessage.set(target.value);
  }

  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    const nextMessage = this.draftMessage().trim();

    if (!nextMessage || !this.canSend() || this.isSending()) {
      return;
    }

    this.sendRequested.emit(nextMessage);
    this.draftMessage.set("");
  }
}
