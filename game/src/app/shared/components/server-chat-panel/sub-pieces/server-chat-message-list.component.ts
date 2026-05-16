import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { MenuItem } from "primeng/api";
import { ContextMenu, ContextMenuModule } from "primeng/contextmenu";

import {
  ServerChatPlayerActionRequest,
  ServerChatCustomEmojiView,
  ServerChatMessageView,
} from "../../../../core/services/server-chat.models";
import { ServerChatRichTextComponent } from "./server-chat-rich-text.component";

@Component({
  selector: "gv-server-chat-message-list",
  standalone: true,
  imports: [ServerChatRichTextComponent, ContextMenuModule],
  templateUrl: "./server-chat-message-list.component.html",
  styleUrl: "./server-chat-message-list.component.scss",
})
export class ServerChatMessageListComponent {
  readonly messages = input.required<readonly ServerChatMessageView[]>();
  readonly customEmojis = input.required<readonly ServerChatCustomEmojiView[]>();
  readonly currentPlayerUuid = input<string | null>(null);
  readonly selectedPlayerUuid = input<string | null>(null);
  readonly canSelectPlayers = input(false);
  readonly canModerate = input(false);

  readonly playerSelected = output<ServerChatMessageView>();
  readonly playerActionRequested = output<ServerChatPlayerActionRequest>();
  protected readonly contextMenuItems = signal<MenuItem[]>([]);
  protected readonly activeContextTargetId = signal<string | null>(null);

  protected readonly viewport =
    viewChild<ElementRef<HTMLDivElement>>("viewport");
  protected readonly contextMenu =
    viewChild.required<ContextMenu>("contextMenu");

  constructor() {
    effect(() => {
      this.messages();

      queueMicrotask(() => {
        const viewport = this.viewport()?.nativeElement;

        if (!viewport) {
          return;
        }

        viewport.scrollTop = viewport.scrollHeight;
      });
    });
  }

  protected trackByMessageId(
    _index: number,
    message: ServerChatMessageView,
  ): string {
    return message.id;
  }

  protected displayName(message: ServerChatMessageView): string {
    const baseName =
      message.displayName?.trim() ||
      message.sender.characterName?.trim() ||
      message.sender.profileDisplayName?.trim() ||
      message.sender.profileId ||
      message.playerUuid;

    return formatGuildTaggedName(baseName, message.sender.guildShortName);
  }

  protected avatarInitials(message: ServerChatMessageView): string {
    return initialsFor(
      message.displayName?.trim() ||
        message.sender.characterName?.trim() ||
        message.sender.profileDisplayName?.trim() ||
        message.sender.profileId ||
        message.playerUuid,
    );
  }

  protected formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  protected isSelfMessage(message: ServerChatMessageView): boolean {
    return message.playerUuid === this.currentPlayerUuid();
  }

  protected isSystemMessage(message: ServerChatMessageView): boolean {
    return (
      message.messageType !== "user" ||
      message.playerUuid === "system" ||
      message.sender.profileId === "system"
    );
  }

  protected canSelectAuthor(message: ServerChatMessageView): boolean {
    return (
      this.canSelectPlayers() &&
      !this.isSelfMessage(message) &&
      !this.isSystemMessage(message)
    );
  }

  protected hasContextActions(message: ServerChatMessageView): boolean {
    return (
      !this.isSelfMessage(message) &&
      !this.isSystemMessage(message) &&
      message.sender.profileId.trim().length > 0
    );
  }

  protected metaLabel(message: ServerChatMessageView): string {
    return this.isSystemMessage(message)
      ? `System - ${this.formatTime(message.createdAt)}`
      : `${message.rank.toUpperCase()} - ${this.formatTime(message.createdAt)}`;
  }

  protected selectPlayer(message: ServerChatMessageView): void {
    if (!this.canSelectAuthor(message)) {
      return;
    }

    this.closeContextMenu();
    this.playerSelected.emit(message);
  }

  protected closeContextMenu(): void {
    this.activeContextTargetId.set(null);
    this.contextMenu().hide();
  }

  protected openContextActions(event: MouseEvent, message: ServerChatMessageView): void {
    event.preventDefault();

    if (!this.hasContextActions(message)) {
      this.closeContextMenu();
      return;
    }

    if (this.activeContextTargetId() === message.id) {
      this.closeContextMenu();
      return;
    }

    this.activeContextTargetId.set(message.id);
    this.contextMenuItems.set(
      buildMessageActionItems(message, this.canModerate(), (request) =>
        this.playerActionRequested.emit(request),
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

function buildMessageActionItems(
  message: ServerChatMessageView,
  canModerate: boolean,
  emit: (request: ServerChatPlayerActionRequest) => void,
): MenuItem[] {
  const targetProfileId = message.sender.profileId;
  const targetPlayerUuid = message.playerUuid;
  const targetCharacterName = message.sender.characterName;
  const items: MenuItem[] = [
    createActionItem("Inspect Profile", "pi pi-id-card", () =>
      emit({
        action: "inspect_profile",
        targetProfileId,
        targetPlayerUuid,
        targetCharacterName,
      }),
    ),
    createActionItem("Whisper", "pi pi-send", () =>
      emit({
        action: "whisper",
        targetProfileId,
        targetPlayerUuid,
        targetCharacterName,
      }),
    ),
    createActionItem("Add Friend", "pi pi-user-plus", () =>
      emit({
        action: "friend_profile",
        targetProfileId,
        targetPlayerUuid,
        targetCharacterName,
      }),
    ),
    createActionItem("Block", "pi pi-ban", () =>
      emit({
        action: "block",
        targetProfileId,
        targetPlayerUuid,
        targetCharacterName,
      }),
    ),
    createActionItem("Report", "pi pi-flag", () =>
      emit({
        action: "report",
        targetProfileId,
        targetPlayerUuid,
        targetCharacterName,
      }),
    ),
    createActionItem("Guild Invite", "pi pi-users", () =>
      emit({
        action: "guild_invite",
        targetProfileId,
        targetPlayerUuid,
        targetCharacterName,
      }),
    ),
  ];

  if (canModerate) {
    items.push(
      { separator: true },
      createActionItem("Ban", "pi pi-shield", () =>
        emit({
          action: "ban",
          targetProfileId,
          targetPlayerUuid,
          targetCharacterName,
        }),
      ),
      createActionItem("Admin Profile", "pi pi-id-card", () =>
        emit({
          action: "admin_profile",
          targetProfileId,
          targetPlayerUuid,
          targetCharacterName,
        }),
      ),
    );
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
