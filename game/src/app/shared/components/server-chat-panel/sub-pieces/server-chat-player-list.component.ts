import { Component, input, output } from "@angular/core";

import {
  ServerChatPlayerActionRequest,
  ServerPresencePlayerView,
} from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-player-list",
  standalone: true,
  templateUrl: "./server-chat-player-list.component.html",
  styleUrl: "./server-chat-player-list.component.scss",
})
export class ServerChatPlayerListComponent {
  readonly players = input.required<readonly ServerPresencePlayerView[]>();
  readonly canModerate = input(false);
  readonly currentPlayerUuid = input<string | null>(null);
  readonly selectedPlayerUuid = input<string | null>(null);

  readonly playerSelected = output<ServerPresencePlayerView>();
  readonly playerActionRequested = output<ServerChatPlayerActionRequest>();

  protected trackByPlayerUuid(
    _index: number,
    player: ServerPresencePlayerView,
  ): string {
    return player.playerUuid;
  }

  protected displayName(player: ServerPresencePlayerView): string {
    return player.displayName?.trim() || "Unknown Adventurer";
  }

  protected avatarInitials(player: ServerPresencePlayerView): string {
    return initialsFor(this.displayName(player));
  }

  protected formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  protected canModeratePlayer(player: ServerPresencePlayerView): boolean {
    return this.canModerate() && player.playerUuid !== this.currentPlayerUuid();
  }

  protected isSelected(player: ServerPresencePlayerView): boolean {
    return player.playerUuid === this.selectedPlayerUuid();
  }

  protected openContextActions(event: MouseEvent, player: ServerPresencePlayerView): void {
    event.preventDefault();
    this.playerActionRequested.emit({
      action: "whisper",
      targetProfileId: player.playerUuid,
      targetCharacterName: player.displayName,
    });
  }
}

function initialsFor(value: string): string {
  const parts = value
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 2);

  if (parts.length === 0) {
    return "?";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
