import { Component, computed, effect, input, output, signal } from "@angular/core";

import {
  type ServerModerationRequest,
  type ServerPresencePlayerView,
} from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-moderation-banner",
  standalone: true,
  templateUrl: "./server-chat-moderation-banner.component.html",
  styleUrl: "./server-chat-moderation-banner.component.scss",
})
export class ServerChatModerationBannerComponent {
  readonly player = input<ServerPresencePlayerView | null>(null);
  readonly canBlockServerEntry = input(false);
  readonly statusMessage = input<string | null>(null);
  readonly submitting = input(false);

  readonly submitted = output<ServerModerationRequest>();
  readonly closed = output<void>();

  protected readonly action = signal<"timeout" | "ban" | "clear">("timeout");
  protected readonly durationMinutes = signal("15");
  protected readonly reason = signal("");
  protected readonly blockServerEntry = signal(false);

  protected readonly title = computed(() => {
    const player = this.player();
    return player ? `Moderation Focus: ${player.displayName ?? "Player"}` : "Moderation Focus";
  });

  constructor() {
    effect(
      () => {
        this.player();
        this.action.set("timeout");
        this.durationMinutes.set("15");
        this.reason.set("");
        this.blockServerEntry.set(false);
      },
      { allowSignalWrites: true },
    );
  }

  protected onActionChange(event: Event): void {
    this.action.set(
      (event.target as HTMLSelectElement).value as "timeout" | "ban" | "clear",
    );

    if (this.action() !== "ban") {
      this.blockServerEntry.set(false);
    }
  }

  protected onDurationInput(event: Event): void {
    this.durationMinutes.set((event.target as HTMLInputElement).value);
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected onBlockServerEntryChange(event: Event): void {
    this.blockServerEntry.set((event.target as HTMLInputElement).checked);
  }

  protected submit(): void {
    const player = this.player();

    if (!player || this.submitting()) {
      return;
    }

    const action = this.action();
    const reason = this.reason().trim();
    const durationMinutes =
      action === "timeout"
        ? Number.parseInt(this.durationMinutes().trim(), 10)
        : undefined;

    if ((action === "timeout" || action === "ban") && reason.length < 3) {
      return;
    }

    if (
      action === "timeout" &&
      (!Number.isInteger(durationMinutes) || (durationMinutes ?? 0) <= 0)
    ) {
      return;
    }

    this.submitted.emit({
      targetUuid: player.profileId,
      action,
      reason: reason || undefined,
      durationMinutes,
      blockServerEntry: action === "ban" ? this.blockServerEntry() : undefined,
    });
  }
}
