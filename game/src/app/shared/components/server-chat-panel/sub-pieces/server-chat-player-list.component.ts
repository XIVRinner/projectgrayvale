import { Component, input, output, signal, viewChild } from "@angular/core";
import { MenuItem } from "primeng/api";
import { ContextMenu, ContextMenuModule } from "primeng/contextmenu";

import {
  ServerChatPlayerActionRequest,
  ServerPresencePlayerView,
} from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-player-list",
  standalone: true,
  imports: [ContextMenuModule],
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
  protected readonly contextMenuItems = signal<MenuItem[]>([]);
  protected readonly activeContextTargetId = signal<string | null>(null);
  protected readonly contextMenu =
    viewChild.required<ContextMenu>("contextMenu");

  protected trackByPlayerUuid(
    _index: number,
    player: ServerPresencePlayerView,
  ): string {
    return player.playerUuid;
  }

  protected displayName(player: ServerPresencePlayerView): string {
    const baseName =
      player.displayName?.trim() ||
      player.profileId?.trim() ||
      player.playerUuid;

    return formatGuildTaggedName(
      baseName,
      player.guildShortName,
    );
  }

  protected avatarInitials(player: ServerPresencePlayerView): string {
    return initialsFor(
      player.displayName?.trim() ||
      player.profileId?.trim() ||
      player.playerUuid,
    );
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

  protected hasContextActions(player: ServerPresencePlayerView): boolean {
    return (
      player.playerUuid !== this.currentPlayerUuid() &&
      Boolean(player.profileId?.trim())
    );
  }

  protected closeContextMenu(): void {
    this.activeContextTargetId.set(null);
    this.contextMenu().hide();
  }

  protected openContextActions(event: MouseEvent, player: ServerPresencePlayerView): void {
    event.preventDefault();

    if (!this.hasContextActions(player)) {
      this.closeContextMenu();
      return;
    }

    if (this.activeContextTargetId() === player.playerUuid) {
      this.closeContextMenu();
      return;
    }

    this.activeContextTargetId.set(player.playerUuid);
    this.contextMenuItems.set(
      buildPlayerActionItems(
        player,
        this.canModeratePlayer(player),
        () => this.playerSelected.emit(player),
        (request) => this.playerActionRequested.emit(request),
      ),
    );
    this.contextMenu().show(event);
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

function formatGuildTaggedName(
  baseName: string,
  guildShortName?: string,
): string {
  const normalizedGuildTag = guildShortName?.trim();

  if (!normalizedGuildTag) {
    return baseName;
  }

  return `${baseName} <${normalizedGuildTag}>`;
}

function buildPlayerActionItems(
  player: ServerPresencePlayerView,
  canFocus: boolean,
  focus: () => void,
  emit: (request: ServerChatPlayerActionRequest) => void,
): MenuItem[] {
  const targetProfileId = player.profileId;
  const items: MenuItem[] = [];

  if (targetProfileId) {
    items.push(
      createActionItem("Whisper", "pi pi-send", () =>
        emit({
          action: "whisper",
          targetProfileId,
          targetPlayerUuid: player.playerUuid,
          targetCharacterName: player.displayName,
        }),
      ),
    );
  }

  if (canFocus) {
    items.unshift(createActionItem("Focus", "pi pi-search", focus));
  }

  return items;
}

function createActionItem(
  label: string,
  icon: string,
  command: () => void,
): MenuItem {
  return {
    label,
    icon,
    command,
  };
}
