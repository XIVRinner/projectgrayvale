import { Component, input, output } from "@angular/core";

import {
  type AdminPlayerListEntryView,
  type AdminProfileDetailView,
  type ServerChatChannelView,
  type ServerChatCommandView,
  type ServerChatCustomEmojiView,
  type ServerChatMessageView,
  type ServerChatPlayerActionRequest,
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
  readonly canShowAdminPanel = input(false);
  readonly adminEntries = input.required<readonly AdminPlayerListEntryView[]>();
  readonly adminTotal = input(0);
  readonly adminPage = input(1);
  readonly adminPageSize = input(20);
  readonly adminSearch = input("");
  readonly adminLoading = input(false);
  readonly selectedAdminProfileId = input<string | null>(null);
  readonly adminProfileDetail = input<AdminProfileDetailView | null>(null);
  readonly grantablePermissions = input.required<readonly string[]>();

  readonly closed = output<void>();
  readonly refreshRequested = output<void>();
  readonly openServerSelectRequested = output<void>();
  readonly grantAdminRequested = output<void>();
  readonly moderatePlayerRequested = output<ServerPresencePlayerView>();
  readonly channelSelected = output<string>();
  readonly playerActionRequested = output<ServerChatPlayerActionRequest>();
  readonly moderationSubmitted = output<ServerModerationRequest>();
  readonly moderationCleared = output<void>();
  readonly sendRequested = output<string>();
  readonly adminSearchChanged = output<string>();
  readonly adminPageChanged = output<number>();
  readonly adminProfileSelected = output<string>();
  readonly adminPermissionGranted = output<{ profileId: string; permissionId: string }>();
  readonly adminPermissionRevoked = output<{ profileId: string; permissionId: string }>();
  readonly adminModerationRequested = output<{ profileId: string; action: "kick" | "ban" | "unban" | "mute" | "unmute" | "warn" }>();
  readonly adminNoteAdded = output<{ profileId: string; body: string }>();
}
