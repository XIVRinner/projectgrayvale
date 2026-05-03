import { Component, computed, input, output } from "@angular/core";

import type { DebugLogEntry } from "../../core/services/game-log/debug-log.service";
import type { GameLogEntry } from "../../core/services/game-log/log-mapper";
import { GameDialogComponent } from "../../shared/components/game-dialog/game-dialog.component";
import { GameDialogSessionView } from "../../shared/components/game-dialog/game-dialog.types";
import { ShellFooterComponent } from "./shell-footer.component";
import { ShellCharacterPanelComponent } from "./sub-pieces/shell-character-panel.component";
import { ShellCharacterCreationDialogComponent } from "./sub-pieces/shell-character-creation-dialog.component";
import { ShellGameplayLogDialogComponent } from "./sub-pieces/shell-gameplay-log-dialog.component";
import { ShellTopbarComponent } from "./sub-pieces/shell-topbar.component";
import { ShellActionPanelComponent } from "./sub-pieces/shell-action-panel.component";
import { ShellQuestTrackerComponent } from "./sub-pieces/shell-quest-tracker.component";
import { ShellSaveManagerModalComponent } from "./sub-pieces/shell-save-manager-modal.component";
import {
  ShellActionGroup,
  ShellCharacterPanel,
  ShellLayoutPreset,
  ShellNavItem,
  ShellQuestTrackerPanel,
  ShellSaveSlotSummary,
  ShellStatusItem,
  ShellTopbarAction,
  ShellTopbarSaveSummary
} from "./shell.types";

@Component({
  selector: "gv-shell-view",
  imports: [
    GameDialogComponent,
    ShellCharacterPanelComponent,
    ShellCharacterCreationDialogComponent,
    ShellFooterComponent,
    ShellGameplayLogDialogComponent,
    ShellTopbarComponent,
    ShellActionPanelComponent,
    ShellQuestTrackerComponent,
    ShellSaveManagerModalComponent
  ],
  templateUrl: "./shell-view.component.html",
  styleUrl: "./shell-view.component.scss"
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
  readonly saveSlots = input.required<readonly ShellSaveSlotSummary[]>();
  readonly isCharacterCreationOpen = input.required<boolean>();
  readonly isCharacterCreationRequired = input.required<boolean>();
  readonly isSaveManagerOpen = input.required<boolean>();
  readonly isGameplayLogOpen = input.required<boolean>();
  readonly gameplayLogEntries = input.required<readonly GameLogEntry[]>();
  readonly debugLogEntries = input.required<readonly DebugLogEntry[]>();
  readonly transferPayload = input.required<string>();
  readonly transferStatusMessage = input<string | null>(null);
  readonly gameDialogSession = input<GameDialogSessionView | null>(null);
  readonly version = input.required<string>();

  readonly characterCreationOpenRequested = output<void>();
  readonly characterCreationCloseRequested = output<void>();
  readonly characterCreated = output<void>();
  readonly saveManagerOpenRequested = output<void>();
  readonly saveManagerCloseRequested = output<void>();
  readonly gameplayLogCloseRequested = output<void>();
  readonly topbarActionSelected = output<string>();
  readonly saveSlotLoadRequested = output<string>();
  readonly saveSlotDeleteRequested = output<string>();
  readonly saveSlotExportRequested = output<string>();
  readonly saveExportAllRequested = output<void>();
  readonly saveImportRequested = output<void>();
  readonly saveResetRequested = output<void>();
  readonly saveTransferPayloadChanged = output<string>();
  readonly actionSelected = output<string>();
  readonly gameDialogAdvanceRequested = output<void>();
  readonly gameDialogChoiceSelected = output<number>();

  protected readonly isCommandCenter = computed(
    () => this.layoutPreset() === "command-center"
  );
}
