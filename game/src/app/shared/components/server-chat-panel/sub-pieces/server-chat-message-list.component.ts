import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from "@angular/core";

import {
  ServerChatCustomEmojiView,
  ServerChatMessageView,
} from "../../../../core/services/server-chat.models";
import { ServerChatRichTextComponent } from "./server-chat-rich-text.component";

@Component({
  selector: "gv-server-chat-message-list",
  standalone: true,
  imports: [ServerChatRichTextComponent],
  templateUrl: "./server-chat-message-list.component.html",
  styleUrl: "./server-chat-message-list.component.scss",
})
export class ServerChatMessageListComponent {
  readonly messages = input.required<readonly ServerChatMessageView[]>();
  readonly customEmojis = input.required<readonly ServerChatCustomEmojiView[]>();
  readonly currentPlayerUuid = input<string | null>(null);
  readonly selectedPlayerUuid = input<string | null>(null);
  readonly canSelectPlayers = input(false);

  readonly playerSelected = output<ServerChatMessageView>();

  protected readonly viewport =
    viewChild<ElementRef<HTMLDivElement>>("viewport");

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
  ): number {
    return message.id;
  }

  protected displayName(message: ServerChatMessageView): string {
    return message.displayName?.trim() || "Unknown Adventurer";
  }

  protected avatarInitials(message: ServerChatMessageView): string {
    return initialsFor(this.displayName(message));
  }

  protected formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  protected selectPlayer(message: ServerChatMessageView): void {
    if (!this.canSelectPlayers()) {
      return;
    }

    this.playerSelected.emit(message);
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
