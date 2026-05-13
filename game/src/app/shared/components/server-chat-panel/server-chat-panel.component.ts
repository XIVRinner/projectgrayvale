import { Component, input, output } from "@angular/core";

import {
  ServerChatChannelView,
  ServerChatCommandView,
  ServerChatCustomEmojiView,
  ServerChatMessageView,
  ServerChatPlayerActionRequest,
  ServerModerationRequest,
  ServerChatPanelView,
  ServerPresencePlayerView,
} from "../../../core/services/server-chat.models";
import { ServerChatComposerComponent } from "./sub-pieces/server-chat-composer.component";
import { ServerChatMessageListComponent } from "./sub-pieces/server-chat-message-list.component";
import { ServerChatModerationBannerComponent } from "./sub-pieces/server-chat-moderation-banner.component";
import { ServerChatPlayerListComponent } from "./sub-pieces/server-chat-player-list.component";

@Component({
  selector: "gv-server-chat-panel",
  standalone: true,
  imports: [
    ServerChatComposerComponent,
    ServerChatMessageListComponent,
    ServerChatModerationBannerComponent,
    ServerChatPlayerListComponent,
  ],
  templateUrl: "./server-chat-panel.component.html",
  styleUrl: "./server-chat-panel.component.scss",
})
export class ServerChatPanelComponent {
  readonly panel = input.required<ServerChatPanelView>();
  readonly players = input.required<readonly ServerPresencePlayerView[]>();
  readonly messages = input.required<readonly ServerChatMessageView[]>();
  readonly customEmojis = input.required<readonly ServerChatCustomEmojiView[]>();
  readonly commands = input.required<readonly ServerChatCommandView[]>();
  readonly channels = input.required<readonly ServerChatChannelView[]>();
  readonly activeChannelId = input<string | null>(null);
  readonly currentPlayerUuid = input<string | null>(null);
  readonly statusMessage = input<string | null>(null);
  readonly canSend = input.required<boolean>();
  readonly canModerate = input(false);
  readonly canBlockServerEntry = input(false);
  readonly isSending = input.required<boolean>();
  readonly sendHint = input<string | null>(null);
  readonly selectedModerationPlayer = input<ServerPresencePlayerView | null>(null);
  readonly moderationStatusMessage = input<string | null>(null);
  readonly isModerationSubmitting = input(false);

  readonly refreshRequested = output<void>();
  readonly openServerSelectRequested = output<void>();
  readonly grantAdminRequested = output<void>();
  readonly sendRequested = output<string>();
  readonly moderatePlayerRequested = output<ServerPresencePlayerView>();
  readonly channelSelected = output<string>();
  readonly playerActionRequested = output<ServerChatPlayerActionRequest>();
  readonly moderationSubmitted = output<ServerModerationRequest>();
  readonly moderationCleared = output<void>();

  protected showGrantAdmin(): boolean {
    return (
      this.panel().isConnected && this.panel().sessionRankLabel !== "ADMIN"
    );
  }

  protected focusMessageAuthor(message: ServerChatMessageView): void {
    if (!this.canModerate()) {
      return;
    }

    const player = this.players().find(
      (entry) => entry.playerUuid === message.playerUuid,
    );

    if (!player || player.playerUuid === this.currentPlayerUuid()) {
      return;
    }

    this.moderatePlayerRequested.emit(player);
  }
}
