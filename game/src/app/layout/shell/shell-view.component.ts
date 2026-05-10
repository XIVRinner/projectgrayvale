import { Component, computed, input, output } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import type { DebugLogEntry } from "../../core/services/game-log/debug-log.service";
import type { GameLogEntry } from "../../core/services/game-log/log-mapper";
import type { GameplayGraphDebugSnapshot } from "../../core/execution-graph/gameplay-graph-runtime.service";
import { GameDialogComponent } from "../../shared/components/game-dialog/game-dialog.component";
import { GameDialogSessionView } from "../../shared/components/game-dialog/game-dialog.types";
import type {
  ServerChatCommandView,
  ServerChatCustomEmojiView,
  ServerChatMessageView,
  ServerModerationRequest,
  ServerChatPanelView,
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
import { ShellTopbarComponent } from "./sub-pieces/shell-topbar.component";
import { ShellActionPanelComponent } from "./sub-pieces/shell-action-panel.component";
import { ShellQuestTrackerComponent } from "./sub-pieces/shell-quest-tracker.component";
import { ShellSaveManagerModalComponent } from "./sub-pieces/shell-save-manager-modal.component";
import { ShellServerSelectModalComponent } from "./sub-pieces/shell-server-select-modal.component";
import {
  ShellActionGroup,
  ShellCharacterPanel,
  ShellLayoutPreset,
  ShellNavItem,
  ShellQuestTrackerPanel,
  ShellSaveSlotSummary,
  ShellStatusItem,
  ShellTopbarAction,
  ShellTopbarSaveSummary,
} from "./shell.types";
import type { ServerDirectoryEntry } from "../../core/services/server-connection.service";

@Component({
  selector: "gv-shell-view",
  imports: [
    RouterOutlet,
    GameDialogComponent,
    ShellCharacterPanelComponent,
    ShellCharacterSheetDialogComponent,
    ShellCharacterCreationDialogComponent,
    ShellFooterComponent,
    ShellGegVisualizerDialogComponent,
    ShellGameplayLogDialogComponent,
    ShellQuestLogDialogComponent,
    ShellServerAdminDialogComponent,
    ShellServerChatDialogComponent,
    ShellTopbarComponent,
    ShellActionPanelComponent,
    ShellQuestTrackerComponent,
    ShellSaveManagerModalComponent,
    ShellServerSelectModalComponent,
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
  readonly actionGroups = input.required<readonly ShellActionGroup[]>();
  readonly characterPanel = input.required<ShellCharacterPanel>();
  readonly questTrackerPanel = input.required<ShellQuestTrackerPanel>();
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
  readonly isServerSelectOpen = input.required<boolean>();
  readonly isServerChatOpen = input.required<boolean>();
  readonly isServerAdminOpen = input.required<boolean>();
  readonly serverFooterSummary = input.required<ServerFooterSummaryView>();
  readonly serverChatPanel = input.required<ServerChatPanelView>();
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
  readonly topbarActionSelected = output<string>();
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
