import { Component, input, output } from "@angular/core";

import {
  type ServerChatCommandView,
  type ServerChatCustomEmojiView,
  type ServerChatMessageView,
  type ServerModerationRequest,
  type ServerChatPanelView,
  type ServerPresencePlayerView,
} from "../../../core/services/server-chat.models";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";
import { ServerChatPanelComponent } from "../../../shared/components/server-chat-panel/server-chat-panel.component";

@Component({
  selector: "gv-shell-server-chat-dialog",
  standalone: true,
  imports: [DialogShellComponent, ServerChatPanelComponent],
  templateUrl: "./shell-server-chat-dialog.component.html",
  styleUrl: "./shell-server-chat-dialog.component.scss",
})
export class ShellServerChatDialogComponent {
  readonly open = input.required<boolean>();
  readonly panel = input.required<ServerChatPanelView>();
  readonly players = input.required<readonly ServerPresencePlayerView[]>();
  readonly messages = input.required<readonly ServerChatMessageView[]>();
  readonly customEmojis = input.required<readonly ServerChatCustomEmojiView[]>();
  readonly commands = input.required<readonly ServerChatCommandView[]>();
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

  readonly closed = output<void>();
  readonly refreshRequested = output<void>();
  readonly openServerSelectRequested = output<void>();
  readonly grantAdminRequested = output<void>();
  readonly moderatePlayerRequested = output<ServerPresencePlayerView>();
  readonly moderationSubmitted = output<ServerModerationRequest>();
  readonly moderationCleared = output<void>();
  readonly sendRequested = output<string>();
}
