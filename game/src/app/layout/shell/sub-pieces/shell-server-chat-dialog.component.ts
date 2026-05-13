import { Component, input, output } from "@angular/core";

import {
  type AdminPlayerListEntryView,
  type AdminProfileDetailView,
  type CurrentGuildView,
  type GuildInvitationView,
  type SocialFriendshipView,
  type ServerChatChannelView,
  type ServerChatCommandView,
  type ServerChatCustomEmojiView,
  type ServerChatMessageView,
  type ServerChatPlayerActionRequest,
  type ServerRelayProfileView,
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
  readonly relayProfile = input<ServerRelayProfileView | null>(null);
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
  readonly socialPlayers = input.required<readonly AdminPlayerListEntryView[]>();
  readonly socialPlayersTotal = input(0);
  readonly socialPlayersPage = input(1);
  readonly socialPlayersPageSize = input(20);
  readonly socialPlayersSearch = input("");
  readonly socialPlayersLoading = input(false);
  readonly friendships = input.required<readonly SocialFriendshipView[]>();
  readonly friendsLoading = input(false);
  readonly currentGuild = input<CurrentGuildView | null>(null);
  readonly guildInvitations = input.required<readonly GuildInvitationView[]>();
  readonly guildLoading = input(false);

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
  readonly socialPlayersSearchChanged = output<string>();
  readonly socialPlayersPageChanged = output<number>();
  readonly friendAddCharacterRequested = output<{ profileId: string; characterId?: string }>();
  readonly friendAddProfileRequested = output<string>();
  readonly friendAcceptRequested = output<string>();
  readonly friendRejectRequested = output<string>();
  readonly friendshipRemoveRequested = output<string>();
  readonly guildCreateRequested = output<{ name: string; shortName: string }>();
  readonly guildInviteRequested = output<{ guildId: string; targetProfileId: string }>();
  readonly guildInvitationResponded = output<{ invitationId: string; accept: boolean }>();
  readonly guildRoleChanged = output<{ guildId: string; characterId: string; role: "guild_master" | "officer" | "member" | "recruit" }>();
  readonly guildLeaveRequested = output<string>();
  readonly channelLeaveRequested = output<string>();
  readonly channelCloseRequested = output<string>();
  readonly channelDestroyRequested = output<string>();
}
