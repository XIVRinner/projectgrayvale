import { Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { type Player, type Race } from "@rinner/grayvale-core";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { GameDialogService } from "../../core/services/game-dialog.service";
import { DebugLogService } from "../../core/services/game-log/debug-log.service";
import { GameplayLogService } from "../../core/services/game-log/gameplay-log.service";
import { GameQuestService } from "../../core/services/game-quest.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
import {
  healthStatesEqual,
  PLAYER_HEALTH_BALANCE_PROFILE_ID,
  reconcileHealthState
} from "../../core/services/health-balance";
import { WorldStateService } from "../../core/services/world-state.service";
import { GameplayGraphRuntime } from "../../core/execution-graph/gameplay-graph-runtime.service";
import {
  CharacterCreatorOptions,
  CharacterCreatorOptionsLoader
} from "../../data/loaders/character-creator-options.loader";

import { buildShellCharacterPanel, ShellCharacterMetadata } from "./shell-character-panel.mapper";
import { ShellViewComponent } from "./shell-view.component";
import {
  ShellActionGroup,
  ShellCharacterPanel,
  ShellLayoutPreset,
  ShellNavItem,
  ShellQuestTrackerEntry,
  ShellQuestTrackerObjective,
  ShellQuestTrackerPanel,
  ShellSaveSlotSummary,
  ShellStatusItem,
  ShellTopbarAction,
  ShellTopbarSaveSummary
} from "./shell.types";

@Component({
  selector: "gv-shell-container",
  imports: [ShellViewComponent],
  template: `
    <gv-shell-view
      [title]="title()"
      [subtitle]="subtitle()"
      [navItems]="navItems()"
      [layoutPreset]="layoutPreset()"
      [statusItems]="statusItems()"
      [saveSummary]="saveSummary()"
      [topbarActions]="topbarActions()"
      [actionGroups]="actionGroups()"
      [characterPanel]="characterPanel()"
      [questTrackerPanel]="questTrackerPanel()"
      [saveSlots]="saveSlots()"
      [isCharacterCreationOpen]="isCharacterCreationOpen()"
      [isCharacterCreationRequired]="isCharacterCreationRequired()"
      [isSaveManagerOpen]="isSaveManagerOpen()"
      [isGameplayLogOpen]="isGameplayLogOpen()"
      [gameplayLogEntries]="gameplayLogEntries()"
      [debugLogEntries]="debugLogEntries()"
      [transferPayload]="transferPayload()"
      [transferStatusMessage]="transferStatusMessage()"
      [gameDialogSession]="gameDialog.session()"
      [version]="version"
      (actionSelected)="handleActionSelected($event)"
      (topbarActionSelected)="handleTopbarActionSelected($event)"
      (gameDialogAdvanceRequested)="advanceGameDialog()"
      (gameDialogChoiceSelected)="chooseGameDialogOption($event)"
      (characterCreationOpenRequested)="openCharacterCreation()"
      (characterCreationCloseRequested)="closeCharacterCreation()"
      (characterCreated)="handleCharacterCreated()"
      (saveManagerOpenRequested)="openSaveManager()"
      (saveManagerCloseRequested)="closeSaveManager()"
      (gameplayLogCloseRequested)="closeGameplayLog()"
      (saveSlotLoadRequested)="loadSlot($event)"
      (saveSlotDeleteRequested)="deleteSlot($event)"
      (saveSlotExportRequested)="exportSlot($event)"
      (saveExportAllRequested)="exportAllSlots()"
      (saveImportRequested)="importSlots()"
      (saveResetRequested)="resetAllSlots()"
      (saveTransferPayloadChanged)="setTransferPayload($event)"
    />
  `
})
export class ShellContainerComponent {
  private readonly roster = inject(CharacterRosterService);
  private readonly creatorOptionsLoader = inject(CharacterCreatorOptionsLoader);
  protected readonly gameDialog = inject(GameDialogService);
  private readonly debugLog = inject(DebugLogService);
  private readonly gameplayLog = inject(GameplayLogService);
  private readonly gameQuests = inject(GameQuestService);
  private readonly gameSettings = inject(GameSettingsService);
  private readonly worldState = inject(WorldStateService);
  private readonly gameplayRuntime = inject(GameplayGraphRuntime);

  protected readonly isCharacterCreationOpenState = signal(false);
  protected readonly isSaveManagerOpen = signal(false);
  protected readonly isGameplayLogOpen = signal(false);
  protected readonly transferPayload = signal("");
  protected readonly transferStatusMessage = signal<string | null>(null);
  private readonly creatorOptions = signal<CharacterCreatorOptions | null>(null);
  protected readonly gameplayLogEntries = toSignal(this.gameplayLog.log$, {
    initialValue: []
  });
  protected readonly debugLogEntries = toSignal(this.debugLog.entries$, {
    initialValue: []
  });

  readonly version = "0.0.1";

  readonly title = signal("@Gray Vale");
  readonly subtitle = computed(() => {
    const activeCharacter = this.roster.activeCharacter();

    if (!activeCharacter) {
      return "Playing as Unknown Adventurer";
    }

    return `Playing as Level ${activeCharacter.progression.level} ${activeCharacter.name}`;
  });

  readonly layoutPreset = signal<ShellLayoutPreset>("command-center");

  readonly isCharacterCreationRequired = computed(
    () => this.saveSlots().length === 0
  );

  readonly isCharacterCreationOpen = computed(
    () => this.isCharacterCreationRequired() || this.isCharacterCreationOpenState()
  );

  readonly navItems = signal<readonly ShellNavItem[]>([
    { label: "Home", route: "/" },
    { label: "Creator Lab", route: "/creator" }
  ]);

  readonly statusItems = computed<readonly ShellStatusItem[]>(() => {
    const items: ShellStatusItem[] = [];
    const locationLabel = this.worldState.currentLocationLabel();
    const sublocationLabel = this.worldState.currentSublocationLabel();
    const loadError = this.worldState.loadError();

    if (locationLabel) {
      items.push({
        label: "Location",
        value: locationLabel
      });
    }

    if (sublocationLabel) {
      items.push({
        label: "Sublocation",
        value: sublocationLabel
      });
    }

    if (loadError) {
      items.push({
        label: "World",
        value: "Unavailable"
      });
    }

    const questMessage = this.gameQuests.latestQuestMessage();

    if (questMessage) {
      items.push({
        label: "Quest",
        value: questMessage
      });
    }

    const attributeMessage = this.gameQuests.latestAttributeMessage();

    if (attributeMessage) {
      items.push({
        label: "Attribute",
        value: attributeMessage
      });
    }

    return items;
  });

  readonly characterMetadata = computed<ShellCharacterMetadata>(() => {
    const options = this.creatorOptions();

    return {
      racesById: new Map(options?.races.map((race) => [race.id, race]) ?? []),
      classesById: new Map(options?.classes.map((option) => [option.id, option]) ?? []),
      attributesById: this.gameSettings.attributesById(),
      skillsById: this.gameSettings.skillsById()
    };
  });

  constructor() {
    this.creatorOptionsLoader
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (options) => {
          this.creatorOptions.set(options);
        },
        error: () => {
          this.creatorOptions.set(null);
        }
      });

    effect(() => {
      if (!this.isCharacterCreationRequired()) {
        return;
      }

      this.isCharacterCreationOpenState.set(true);
      this.isSaveManagerOpen.set(false);
    });

    effect(() => {
      const activeSlot = this.roster.activeSlot();
      const healthProfile =
        this.gameSettings.balanceProfileFor(PLAYER_HEALTH_BALANCE_PROFILE_ID) ?? undefined;

      if (!activeSlot || !healthProfile) {
        return;
      }

      const reconciledHealth = reconcileHealthState(
        activeSlot.player,
        activeSlot.health,
        healthProfile
      );

      if (healthStatesEqual(activeSlot.health, reconciledHealth)) {
        return;
      }

      queueMicrotask(() => {
        const latestSlot = this.roster.activeSlot();

        if (!latestSlot || latestSlot.id !== activeSlot.id) {
          return;
        }

        if (healthStatesEqual(latestSlot.health, reconciledHealth)) {
          return;
        }

        this.roster.updateActiveHealth(reconciledHealth);
      });
    });
  }

  readonly saveSlots = computed<readonly ShellSaveSlotSummary[]>(() => {
    const activeSlotId = this.roster.activeSlotId();
    const racesById = new Map(this.creatorOptions()?.races.map((race) => [race.id, race]) ?? []);

    return this.roster.slots().map((slot) => ({
      id: slot.id,
      name: slot.player.name,
      raceId: slot.player.raceId,
      classId: slot.player.jobClass,
      level: slot.player.progression.level,
      locationId: slot.world.currentLocation,
      difficultyMode: slot.player.difficulty?.mode ?? "normal",
      expertMode: slot.player.difficulty?.expert ?? false,
      ironmanMode: slot.player.difficulty?.ironman ?? false,
      talents: slot.player.talents ?? [],
      portraitSrc: resolveSaveSlotPortraitPath(slot.player, racesById),
      portraitAlt: `${slot.player.name} portrait`,
      createdAt: formatSaveTimestamp(slot.createdAt),
      updatedAt: formatSaveTimestamp(slot.updatedAt),
      isActive: slot.id === activeSlotId
    }));
  });

  readonly saveSummary = computed<ShellTopbarSaveSummary>(() => {
    const activeSlot = this.roster.activeSlot();

    if (!activeSlot) {
      return {
        lead: "Unknown Adventurer",
        lastSaved: "—"
      };
    }

    return {
      lead: activeSlot.player.name,
      characterName: activeSlot.player.name,
      lastSaved: formatSaveTimestamp(activeSlot.updatedAt)
    };
  });

  readonly topbarActions = computed<readonly ShellTopbarAction[]>(() => {
    const logEntryCount = this.gameplayLogEntries().length;

    return [
    // GAP: MessageLogModalService not yet available — button is a placeholder
    {
      id: TOPBAR_GAMEPLAY_LOG_ACTION_ID,
      label: "Gameplay Log",
      icon: "pi pi-list",
      badge: logEntryCount > 0 ? logEntryCount : undefined,
      tone: "default"
    },
    // GAP: AchievementModalService not yet available
    {
      id: TOPBAR_ACHIEVEMENTS_ACTION_ID,
      label: "Achievements",
      icon: "pi pi-trophy",
      tone: "accent",
      disabled: true
    },
    // GAP: WikiModalService not yet available
    {
      id: TOPBAR_GALLERY_ACTION_ID,
      label: "Gallery",
      icon: "pi pi-images",
      tone: "cool",
      disabled: true
    },
    // GAP: SettingsService not yet available
    {
      id: TOPBAR_SETTINGS_ACTION_ID,
      label: "Settings",
      icon: "pi pi-cog",
      tone: "default",
      disabled: true
    }
    ];
  });

  readonly actionGroups = computed<readonly ShellActionGroup[]>(
    () => this.gameplayRuntime.actionGroups()
  );

  readonly characterPanel = computed<ShellCharacterPanel>(() => {
    const activeSlot = this.roster.activeSlot();
    const activeCharacter = activeSlot?.player ?? null;
    const difficultyMode = activeCharacter?.difficulty?.mode ?? "normal";

    return buildShellCharacterPanel(
      activeCharacter,
      this.characterMetadata(),
      activeSlot?.statUnlocks,
      this.roster.activeHealth(),
      this.gameSettings.balanceProfileFor(PLAYER_HEALTH_BALANCE_PROFILE_ID) ?? undefined,
      this.gameSettings.difficultyCurveFor(difficultyMode) ?? undefined
    );
  });

  readonly questTrackerPanel = computed<ShellQuestTrackerPanel>(() =>
    buildQuestTrackerPanel(
      this.gameQuests.runtimeStates(),
      this.gameQuests.authoredQuests(),
      this.gameSettings.attributesById()
    )
  );

  protected openCharacterCreation(): void {
    this.logUi("Opening character creation dialog.");
    this.transferStatusMessage.set(null);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isCharacterCreationOpenState.set(true);
  }

  protected closeCharacterCreation(): void {
    if (this.isCharacterCreationRequired()) {
      this.logUi("Ignored character creation close because a character is still required.");
      return;
    }

    this.logUi("Closing character creation dialog.");
    this.isCharacterCreationOpenState.set(false);
  }

  protected handleCharacterCreated(): void {
    this.logUi("Character creation completed.");
    this.isCharacterCreationOpenState.set(false);
    this.transferStatusMessage.set("Character registered and active.");
  }

  protected openSaveManager(): void {
    this.logUi("Opening save manager.");
    this.isCharacterCreationOpenState.set(false);
    this.isGameplayLogOpen.set(false);
    this.isSaveManagerOpen.set(true);
    this.transferStatusMessage.set(null);
  }

  protected closeSaveManager(): void {
    this.logUi("Closing save manager.");
    this.isSaveManagerOpen.set(false);
  }

  protected openGameplayLog(): void {
    this.logUi("Opening gameplay log dialog.", {
      gameplayEntries: this.gameplayLogEntries().length,
      debugEntries: this.debugLogEntries().length
    });
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(true);
  }

  protected closeGameplayLog(): void {
    this.logUi("Closing gameplay log dialog.");
    this.isGameplayLogOpen.set(false);
  }

  protected loadSlot(slotId: string): void {
    this.logUi("Loading save slot.", { slotId });
    this.roster.setActiveSlot(slotId);
    this.transferStatusMessage.set(`Loaded ${formatSlotLabel(slotId)}.`);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
  }

  protected deleteSlot(slotId: string): void {
    this.logUi("Deleting save slot.", { slotId });
    const deleted = this.roster.deleteSlot(slotId);

    if (!deleted) {
      this.logUi("Save slot delete failed.", { slotId });
      this.transferStatusMessage.set(`Could not delete ${formatSlotLabel(slotId)}.`);
      return;
    }

    this.logUi("Save slot deleted.", { slotId });
    this.transferStatusMessage.set(`Deleted ${formatSlotLabel(slotId)}.`);
  }

  protected exportSlot(slotId: string): void {
    this.logUi("Exporting save slot.", { slotId });
    const payload = this.roster.exportSlot(slotId);

    if (!payload) {
      this.logUi("Save slot export failed.", { slotId });
      this.transferStatusMessage.set(`Could not export ${formatSlotLabel(slotId)}.`);
      return;
    }

    this.logUi("Save slot exported.", {
      slotId,
      payloadLength: payload.length
    });
    this.transferPayload.set(payload);
    this.transferStatusMessage.set(`Prepared export for ${formatSlotLabel(slotId)}.`);
  }

  protected exportAllSlots(): void {
    const payload = this.roster.exportAll();

    this.logUi("Exporting all save slots.", {
      payloadLength: payload.length,
      slotCount: this.saveSlots().length
    });
    this.transferPayload.set(payload);
    this.transferStatusMessage.set("Prepared export for all save slots.");
  }

  protected importSlots(): void {
    const payload = this.transferPayload().trim();

    if (payload.length === 0) {
      this.logUi("Ignored save import because the payload was empty.");
      this.transferStatusMessage.set("Paste a save payload before importing.");
      return;
    }

    try {
      const importedCount = this.roster.importRoster(payload);
      this.logUi("Imported save payload.", {
        importedCount,
        payloadLength: payload.length
      });
      this.transferStatusMessage.set(`Imported ${importedCount} save slot(s).`);
    } catch (error) {
      this.logUi("Save import failed.", errorToMessage(error));
      this.transferStatusMessage.set(errorToMessage(error));
    }
  }

  protected resetAllSlots(): void {
    this.logUi("Resetting all save slots.", {
      previousSlotCount: this.saveSlots().length
    });
    this.roster.resetAll();
    this.transferPayload.set("");
    this.transferStatusMessage.set("All save slots were reset.");
  }

  protected setTransferPayload(value: string): void {
    this.logUi("Updated save transfer payload.", {
      payloadLength: value.length
    });
    this.transferPayload.set(value);
  }

  protected handleActionSelected(actionId: string): void {
    this.logUi("Gameplay action selected.", { actionId });
    const result = this.gameplayRuntime.executeAction(actionId);

    if (!result.ok) {
      this.logUi("Action execution returned a failure.", {
        actionId,
        reason: result.reason
      });
    }
  }

  protected handleTopbarActionSelected(actionId: string): void {
    this.logUi("Topbar action selected.", { actionId });
    if (actionId === TOPBAR_GAMEPLAY_LOG_ACTION_ID) {
      this.openGameplayLog();
    }
  }

  protected advanceGameDialog(): void {
    this.logUi("Dialogue advance requested from shell.");
    this.gameDialog.advance();
  }

  protected chooseGameDialogOption(index: number): void {
    this.logUi("Dialogue choice selected from shell.", { index });
    this.gameDialog.choose(index);
  }

  private logUi(message: string, details?: unknown): void {
    this.debugLog.logMessage("shell", message, details);
  }
}

const TOPBAR_GAMEPLAY_LOG_ACTION_ID = "topbar:gameplay-log";
const TOPBAR_ACHIEVEMENTS_ACTION_ID = "topbar:achievements";
const TOPBAR_GALLERY_ACTION_ID = "topbar:gallery";
const TOPBAR_SETTINGS_ACTION_ID = "topbar:settings";

function formatSaveTimestamp(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleString();
}

function formatSlotLabel(slotId: string): string {
  return slotId.replace(/_/g, " ").toUpperCase();
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Import failed due to an unknown error.";
}

function resolveSaveSlotPortraitPath(
  player: Player,
  racesById: ReadonlyMap<string, Race>
): string | undefined {
  const race = racesById.get(player.raceId);
  const appearance = player.selectedAppearance;

  if (!race || !appearance) {
    return undefined;
  }

  const portraitFile = race.variants?.[appearance.variant]?.[appearance.imageIndex];

  if (!portraitFile) {
    return undefined;
  }

  return `${race.imageBasePath}/${appearance.variant}/${portraitFile}`;
}

function buildQuestTrackerPanel(
  runtimeStates: readonly ReturnType<GameQuestService["runtimeStates"]>[number][],
  quests: readonly ReturnType<GameQuestService["authoredQuests"]>[number][],
  attributesById: ReadonlyMap<string, { name: string }>
): ShellQuestTrackerPanel {
  return {
    title: "Quest Tracker",
    emptyLabel: "No active quests. Story and field work will appear here when they are underway.",
    entries: runtimeStates.map((state) =>
      buildQuestTrackerEntry(state, quests.find((quest) => quest.id === state.questId), attributesById)
    )
  };
}

function buildQuestTrackerEntry(
  state: ReturnType<GameQuestService["runtimeStates"]>[number],
  quest: ReturnType<GameQuestService["authoredQuests"]>[number] | undefined,
  attributesById: ReadonlyMap<string, { name: string }>
): ShellQuestTrackerEntry {
  const questTitle = prettyQuestTitle(quest?.id ?? state.questId);
  const rootObjectives = Object.entries(state.objectives)
    .filter(([objectiveId]) => isLeafObjectiveId(objectiveId, state))
    .map(([objectiveId, progress]) =>
      buildQuestTrackerObjective(
        objectiveId,
        progress,
        quest,
        attributesById
      )
    );

  return {
    id: state.questId,
    title: questTitle,
    status: state.completed ? "completed" : "active",
    summary:
      rootObjectives[0]?.progressLabel ??
      (state.completed ? "Completed." : "In progress."),
    objectives: rootObjectives
  };
}

function buildQuestTrackerObjective(
  objectiveId: string,
  progress: { current: number; target: number; completed: boolean },
  quest: ReturnType<GameQuestService["authoredQuests"]>[number] | undefined,
  attributesById: ReadonlyMap<string, { name: string }>
): ShellQuestTrackerObjective {
  const objective = resolveObjectiveById(quest, objectiveId);

  if (objective?.type === "attribute_reached") {
    const attributeName = attributesById.get(objective.attribute)?.name ?? prettyQuestTitle(objective.attribute);

    return {
      id: objectiveId,
      label: attributeName,
      progressLabel: `${formatTrackerScore(progress.current)} / ${formatTrackerScore(progress.target)}`,
      completed: progress.completed
    };
  }

  return {
    id: objectiveId,
    label: "Objective",
    progressLabel: `${formatTrackerScore(progress.current)} / ${formatTrackerScore(progress.target)}`,
    completed: progress.completed
  };
}

function resolveObjectiveById(
  quest: ReturnType<GameQuestService["authoredQuests"]>[number] | undefined,
  objectiveId: string
): ReturnType<GameQuestService["authoredQuests"]>[number]["objectives"][number] | null {
  if (!quest) {
    return null;
  }

  const segments = objectiveId.split(":")[1]?.split(".") ?? [];

  if (segments.length === 0) {
    return null;
  }

  let currentObjective = quest.objectives[Number(segments[0])];

  for (const segment of segments.slice(1)) {
    if (!currentObjective || currentObjective.type !== "composite") {
      return null;
    }

    currentObjective = currentObjective.objectives[Number(segment)];
  }

  return currentObjective ?? null;
}

function isLeafObjectiveId(
  objectiveId: string,
  state: ReturnType<GameQuestService["runtimeStates"]>[number]
): boolean {
  return !Object.keys(state.objectives).some(
    (candidateId) => candidateId !== objectiveId && candidateId.startsWith(`${objectiveId}.`)
  );
}

function prettyQuestTitle(value: string): string {
  return value
    .replace(/^quest_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTrackerScore(value: number): string {
  return value.toFixed(1);
}
