import { Component, computed, input, output } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import type { ChangelogRelease } from "../../features/changelog/changelog.types";

import type { DebugLogEntry } from "../../core/services/game-log/debug-log.service";
import type { GameLogEntry } from "../../core/services/game-log/log-mapper";
import type { GameplayGraphDebugSnapshot } from "../../core/execution-graph/gameplay-graph-runtime.service";
import { GameDialogComponent } from "../../shared/components/game-dialog/game-dialog.component";
import { GameDialogSessionView } from "../../shared/components/game-dialog/game-dialog.types";
import type {
  AdminPlayerListEntryView,
  AdminProfileDetailView,
  CurrentGuildView,
  GuildInvitationView,
  SocialFriendshipView,
  ServerChatPlayerActionRequest,
  ServerChatCommandView,
  ServerChatCustomEmojiView,
  ServerChatMessageView,
  ServerModerationRequest,
  ServerChatPanelView,
  ServerRelayProfileView,
  ServerFooterSummaryView,
  ServerPresencePlayerView,
} from "../../core/services/server-chat.models";
import type { QuestViewModel } from "./quest-log/quest-view-model";
import { ShellFooterComponent } from "./shell-footer.component";
import { ShellCharacterPanelComponent } from "./sub-pieces/shell-character-panel.component";
import { ShellCharacterSheetDialogComponent } from "./sub-pieces/shell-character-sheet-dialog.component";
import { ShellCharacterCreationDialogComponent } from "./sub-pieces/shell-character-creation-dialog.component";
import { ShellGegVisualizerDialogComponent } from "./sub-pieces/shell-geg-visualizer-dialog.component";
import { ShellGameplayLogDialogComponent } from "./sub-pieces/shell-gameplay-log-dialog.component";
import { ShellQuestLogDialogComponent } from "./sub-pieces/shell-quest-log-dialog.component";
import { ShellServerAdminDialogComponent } from "./sub-pieces/shell-server-admin-dialog.component";
import { ShellServerChatDialogComponent } from "./sub-pieces/shell-server-chat-dialog.component";
import { ShellKairosEditDialogComponent } from "./sub-pieces/shell-kairos-edit-dialog.component";
import { ShellTopbarComponent } from "./sub-pieces/shell-topbar.component";
import { ShellActionPanelComponent } from "./sub-pieces/shell-action-panel.component";
import { ShellQuestTrackerComponent } from "./sub-pieces/shell-quest-tracker.component";
import { ShellMiniChatComponent } from "./sub-pieces/shell-mini-chat.component";
import { ShellSaveManagerModalComponent } from "./sub-pieces/shell-save-manager-modal.component";
import { ShellServerSelectModalComponent } from "./sub-pieces/shell-server-select-modal.component";
import { WhatsNewModalComponent } from "../../shared/components/changelog/whats-new-modal.component";
import {
  ShellActionGroup,
  ShellCharacterPanel,
  ShellLayoutPreset,
  ShellMiniChatPanel,
  ShellNavItem,
  ShellQuestTrackerPanel,
  ShellSaveSlotSummary,
  ShellStatusItem,
  ShellTopbarAction,
  ShellTopbarSaveSummary,
} from "./shell.types";
import type { ServerDirectoryEntry } from "../../core/services/server-connection.service";
import type { ServerProfile } from "../../core/services/server-profile.service";

@Component({
  selector: "gv-shell-view",
  imports: [
    RouterOutlet,
    GameDialogComponent,
    ShellCharacterPanelComponent,
    ShellCharacterSheetDialogComponent,
    ShellCharacterCreationDialogComponent,
    ShellFooterComponent,
    ShellKairosEditDialogComponent,
    ShellGegVisualizerDialogComponent,
    ShellGameplayLogDialogComponent,
    ShellQuestLogDialogComponent,
    ShellServerAdminDialogComponent,
    ShellServerChatDialogComponent,
    ShellTopbarComponent,
    ShellActionPanelComponent,
    ShellQuestTrackerComponent,
    ShellMiniChatComponent,
    ShellSaveManagerModalComponent,
    ShellServerSelectModalComponent,
    WhatsNewModalComponent,
  ],
  templateUrl: "./shell-view.component.html",
  styleUrl: "./shell-view.component.scss",
})
export class ShellViewComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly navItems = input.required<readonly ShellNavItem[]>();
  readonly layoutPreset = input.required<ShellLayoutPreset>();
  readonly statusItems = input.required<readonly ShellStatusItem[]>();
  readonly saveSummary = input.required<ShellTopbarSaveSummary>();
  readonly topbarActions = input.required<readonly ShellTopbarAction[]>();
  readonly whatsNewUnreadCount = input(0);
  readonly canOpenKairosEdit = input(false);
  readonly isKairosEditOpen = input.required<boolean>();
  readonly isWhatsNewOpen = input.required<boolean>();
  readonly whatsNewReleases = input.required<readonly ChangelogRelease[]>();
  readonly isWhatsNewLoading = input.required<boolean>();
  readonly whatsNewErrorMessage = input<string | null>(null);
  readonly actionGroups = input.required<readonly ShellActionGroup[]>();
  readonly characterPanel = input.required<ShellCharacterPanel>();
  readonly questTrackerPanel = input.required<ShellQuestTrackerPanel>();
  readonly miniChatPanel = input.required<ShellMiniChatPanel>();
  readonly questLogQuests = input.required<readonly QuestViewModel[]>();
  readonly trackedQuestIds = input.required<readonly string[]>();
  readonly saveSlots = input.required<readonly ShellSaveSlotSummary[]>();
  readonly isCharacterSheetOpen = input.required<boolean>();
  readonly isCharacterCreationOpen = input.required<boolean>();
  readonly isCharacterCreationRequired = input.required<boolean>();
  readonly isSaveManagerOpen = input.required<boolean>();
  readonly isGameplayLogOpen = input.required<boolean>();
  readonly isQuestLogOpen = input.required<boolean>();
  readonly isGegVisualizerOpen = input.required<boolean>();
  readonly gameplayLogEntries = input.required<readonly GameLogEntry[]>();
  readonly debugLogEntries = input.required<readonly DebugLogEntry[]>();
  readonly gegDebugSnapshot = input<GameplayGraphDebugSnapshot | null>(null);
  readonly transferPayload = input.required<string>();
  readonly transferStatusMessage = input<string | null>(null);
  readonly servers = input.required<readonly ServerDirectoryEntry[]>();
  readonly selectedServerId = input.required<string>();
  readonly activePlayerUuid = input<string | null>(null);
  readonly serverStatusMessage = input<string | null>(null);
  readonly serverProfile = input<ServerProfile | null>(null);
  readonly isServerSelectOpen = input.required<boolean>();
  readonly isServerChatOpen = input.required<boolean>();
  readonly isServerAdminOpen = input.required<boolean>();
  readonly serverFooterSummary = input.required<ServerFooterSummaryView>();
  readonly serverChatPanel = input.required<ServerChatPanelView>();
  readonly serverRelayProfile = input<ServerRelayProfileView | null>(null);
  readonly serverChatPlayers =
    input.required<readonly ServerPresencePlayerView[]>();
  readonly serverChatMessages =
    input.required<readonly ServerChatMessageView[]>();
  readonly serverChatCustomEmojis =
    input.required<readonly ServerChatCustomEmojiView[]>();
  readonly serverChatCommands =
    input.required<readonly ServerChatCommandView[]>();
  readonly currentServerChatPlayerUuid = input<string | null>(null);
  readonly selectedModerationPlayer = input<ServerPresencePlayerView | null>(null);
  readonly serverChatStatusMessage = input<string | null>(null);
  readonly serverAdminStatusMessage = input<string | null>(null);
  readonly serverModerationStatusMessage = input<string | null>(null);
  readonly serverChatSendHint = input<string | null>(null);
  readonly canSendServerChat = input.required<boolean>();
  readonly canModerateServerChat = input.required<boolean>();
  readonly canBlockServerEntry = input.required<boolean>();
  readonly isServerChatSending = input.required<boolean>();
  readonly isServerAdminSubmitting = input.required<boolean>();
  readonly isServerModerationSubmitting = input.required<boolean>();
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
  readonly gameDialogSession = input<GameDialogSessionView | null>(null);
  readonly version = input.required<string>();

  readonly characterCreationOpenRequested = output<void>();
  readonly characterSheetCloseRequested = output<void>();
  readonly characterCreationCloseRequested = output<void>();
  readonly characterCreated = output<void>();
  readonly saveManagerOpenRequested = output<void>();
  readonly saveManagerCloseRequested = output<void>();
  readonly gameplayLogCloseRequested = output<void>();
  readonly questLogOpenRequested = output<void>();
  readonly questLogCloseRequested = output<void>();
  readonly trackedQuestIdsChanged = output<readonly string[]>();
  readonly gegVisualizerOpenRequested = output<void>();
  readonly gegVisualizerCloseRequested = output<void>();
  readonly kairosEditRequested = output<void>();
  readonly kairosEditCloseRequested = output<void>();
  readonly topbarActionSelected = output<string>();
  readonly whatsNewOpenRequested = output<void>();
  readonly whatsNewCloseRequested = output<void>();
  readonly whatsNewMarkReadRequested = output<void>();
  readonly saveSlotLoadRequested = output<string>();
  readonly saveSlotDeleteRequested = output<string>();
  readonly saveSlotExportRequested = output<string>();
  readonly saveExportAllRequested = output<void>();
  readonly saveImportRequested = output<void>();
  readonly saveResetRequested = output<void>();
  readonly saveTransferPayloadChanged = output<string>();
  readonly serverSelectCloseRequested = output<void>();
  readonly serverInfoRequested = output<void>();
  readonly serverChatCloseRequested = output<void>();
  readonly serverAdminCloseRequested = output<void>();
  readonly serverChanged = output<string>();
  readonly serverAdded = output<{
    host: string;
    port: number;
    clientId: string;
  }>();
  readonly serverConnectRequested = output<{ password: string }>();
  readonly serverGiveAdminRequested = output<{ adminPassword: string }>();
  readonly serverChatRefreshRequested = output<void>();
  readonly serverChatGrantAdminRequested = output<void>();
  readonly serverChatModeratePlayerRequested = output<ServerPresencePlayerView>();
  readonly serverAdminSubmitted = output<string>();
  readonly serverModerationSubmitted = output<ServerModerationRequest>();
  readonly serverModerationCleared = output<void>();
  readonly serverChatSendRequested = output<string>();
  readonly serverChatChannelSelected = output<string>();
  readonly serverChatPlayerActionRequested = output<ServerChatPlayerActionRequest>();
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
  readonly serverChatServerSelectRequested = output<void>();
  readonly actionSelected = output<string>();
  readonly characterPanelActionSelected = output<string>();
  readonly gameDialogAdvanceRequested = output<void>();
  readonly gameDialogChoiceSelected = output<number>();
  readonly gameDialogCloseRequested = output<void>();

  protected readonly isCommandCenter = computed(
    () => this.layoutPreset() === "command-center",
  );
}
