import { Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { type ActivityDefinition, type Player } from "@rinner/grayvale-core";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { GameDialogService } from "../../core/services/game-dialog.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
import { WorldStateService } from "../../core/services/world-state.service";
import { ActivitiesLoader } from "../../data/loaders/activities.loader";
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
      [saveSlots]="saveSlots()"
      [isCharacterCreationOpen]="isCharacterCreationOpen()"
      [isCharacterCreationRequired]="isCharacterCreationRequired()"
      [isSaveManagerOpen]="isSaveManagerOpen()"
      [transferPayload]="transferPayload()"
      [transferStatusMessage]="transferStatusMessage()"
      [gameDialogSession]="gameDialog.session()"
      [version]="version"
      (actionSelected)="handleActionSelected($event)"
      (gameDialogAdvanceRequested)="advanceGameDialog()"
      (gameDialogChoiceSelected)="chooseGameDialogOption($event)"
      (characterCreationOpenRequested)="openCharacterCreation()"
      (characterCreationCloseRequested)="closeCharacterCreation()"
      (characterCreated)="handleCharacterCreated()"
      (saveManagerOpenRequested)="openSaveManager()"
      (saveManagerCloseRequested)="closeSaveManager()"
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
  private readonly activitiesLoader = inject(ActivitiesLoader);
  private readonly creatorOptionsLoader = inject(CharacterCreatorOptionsLoader);
  protected readonly gameDialog = inject(GameDialogService);
  private readonly gameSettings = inject(GameSettingsService);
  private readonly worldState = inject(WorldStateService);

  protected readonly isCharacterCreationOpenState = signal(false);
  protected readonly isSaveManagerOpen = signal(false);
  protected readonly transferPayload = signal("");
  protected readonly transferStatusMessage = signal<string | null>(null);
  private readonly activities = signal<readonly ActivityDefinition[]>([]);
  private readonly creatorOptions = signal<CharacterCreatorOptions | null>(null);

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

    this.activitiesLoader
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (activities) => {
          this.activities.set(activities);
        },
        error: () => {
          this.activities.set([]);
        }
      });

    effect(() => {
      if (!this.isCharacterCreationRequired()) {
        return;
      }

      this.isCharacterCreationOpenState.set(true);
      this.isSaveManagerOpen.set(false);
    });
  }

  readonly saveSlots = computed<readonly ShellSaveSlotSummary[]>(() => {
    const activeSlotId = this.roster.activeSlotId();

    return this.roster.slots().map((slot) => ({
      id: slot.id,
      name: slot.player.name,
      raceId: slot.player.raceId,
      classId: slot.player.jobClass,
      level: slot.player.progression.level,
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

  readonly topbarActions = signal<readonly ShellTopbarAction[]>([
    // GAP: MessageLogModalService not yet available — button is a placeholder
    { label: "Gameplay Log", icon: "pi pi-list", badge: 0, tone: "default", disabled: true },
    // GAP: AchievementModalService not yet available
    { label: "Achievements", icon: "pi pi-trophy", tone: "accent", disabled: true },
    // GAP: WikiModalService not yet available
    { label: "Gallery", icon: "pi pi-images", tone: "cool", disabled: true },
    // GAP: SettingsService not yet available
    { label: "Settings", icon: "pi pi-cog", tone: "default", disabled: true }
  ]);

  readonly actionGroups = computed<readonly ShellActionGroup[]>(() =>
    buildShellActionGroups(
      this.roster.activeCharacter(),
      this.roster.activeWorld(),
      this.activities(),
      this.worldState.actionGroups().map((group) => ({
        label: group.label,
        tone: group.tone,
        choices: group.choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          disabled: choice.disabled,
          disabledReason: choice.disabledReason
        }))
      }))
    )
  );

  readonly characterPanel = computed<ShellCharacterPanel>(() => {
    return buildShellCharacterPanel(this.roster.activeCharacter(), this.characterMetadata());
  });

  protected openCharacterCreation(): void {
    this.transferStatusMessage.set(null);
    this.isSaveManagerOpen.set(false);
    this.isCharacterCreationOpenState.set(true);
  }

  protected closeCharacterCreation(): void {
    if (this.isCharacterCreationRequired()) {
      return;
    }

    this.isCharacterCreationOpenState.set(false);
  }

  protected handleCharacterCreated(): void {
    this.isCharacterCreationOpenState.set(false);
    this.transferStatusMessage.set("Character registered and active.");
  }

  protected openSaveManager(): void {
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(true);
    this.transferStatusMessage.set(null);
  }

  protected closeSaveManager(): void {
    this.isSaveManagerOpen.set(false);
  }

  protected loadSlot(slotId: string): void {
    this.roster.setActiveSlot(slotId);
    this.transferStatusMessage.set(`Loaded ${formatSlotLabel(slotId)}.`);
    this.isSaveManagerOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
  }

  protected deleteSlot(slotId: string): void {
    const deleted = this.roster.deleteSlot(slotId);

    if (!deleted) {
      this.transferStatusMessage.set(`Could not delete ${formatSlotLabel(slotId)}.`);
      return;
    }

    this.transferStatusMessage.set(`Deleted ${formatSlotLabel(slotId)}.`);
  }

  protected exportSlot(slotId: string): void {
    const payload = this.roster.exportSlot(slotId);

    if (!payload) {
      this.transferStatusMessage.set(`Could not export ${formatSlotLabel(slotId)}.`);
      return;
    }

    this.transferPayload.set(payload);
    this.transferStatusMessage.set(`Prepared export for ${formatSlotLabel(slotId)}.`);
  }

  protected exportAllSlots(): void {
    this.transferPayload.set(this.roster.exportAll());
    this.transferStatusMessage.set("Prepared export for all save slots.");
  }

  protected importSlots(): void {
    const payload = this.transferPayload().trim();

    if (payload.length === 0) {
      this.transferStatusMessage.set("Paste a save payload before importing.");
      return;
    }

    try {
      const importedCount = this.roster.importRoster(payload);
      this.transferStatusMessage.set(`Imported ${importedCount} save slot(s).`);
    } catch (error) {
      this.transferStatusMessage.set(errorToMessage(error));
    }
  }

  protected resetAllSlots(): void {
    this.roster.resetAll();
    this.transferPayload.set("");
    this.transferStatusMessage.set("All save slots were reset.");
  }

  protected setTransferPayload(value: string): void {
    this.transferPayload.set(value);
  }

  protected handleActionSelected(actionId: string): void {
    if (actionId === WAKE_UP_ACTION_ID) {
      this.gameDialog.startPrologue();
      return;
    }

    if (actionId.startsWith(ACTIVITY_ACTION_PREFIX)) {
      // GAP: Activity runtime
      // Blocked on: design / future activity executor
      // Needs: actual tick runner, activity-start flow, and reward/stat progression rules
      // Do not implement until: an authored activity runtime contract exists beyond availability state
      return;
    }

    this.worldState.executeAction(actionId);
  }

  protected advanceGameDialog(): void {
    this.gameDialog.advance();
  }

  protected chooseGameDialogOption(index: number): void {
    this.gameDialog.choose(index);
  }
}

const WAKE_UP_ACTION_ID = "story:wake-up";
const ACTIVITY_ACTION_PREFIX = "activity:";
const PROLOGUE_ARC_ID = "prologue";
const PROLOGUE_COMPLETE_CHAPTER = 2;
const RECOVER_ACTIVITY_ID = "recover";

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

function buildShellActionGroups(
  player: Player | null,
  world: ReturnType<CharacterRosterService["activeWorld"]>,
  activities: readonly ActivityDefinition[],
  worldActionGroups: readonly ShellActionGroup[]
): readonly ShellActionGroup[] {
  if (!player || !world) {
    return [];
  }

  if (isWakeUpPrologueState(player, world)) {
    return [
      {
        label: "Story",
        tone: "talk",
        choices: [
          {
            id: WAKE_UP_ACTION_ID,
            label: "Wake up"
          }
        ]
      }
    ];
  }

  const activityGroup = buildRecoveryGroup(player, activities);

  if (!activityGroup) {
    return worldActionGroups;
  }

  return [...worldActionGroups, activityGroup];
}

function isWakeUpPrologueState(
  player: Player,
  world: NonNullable<ReturnType<CharacterRosterService["activeWorld"]>>
): boolean {
  return (
    world.currentLocation === "village-arkama" &&
    world.sublocations.at(-1) === "chief-house" &&
    player.story?.currentArcId === PROLOGUE_ARC_ID &&
    player.story.currentChapter < PROLOGUE_COMPLETE_CHAPTER
  );
}

function buildRecoveryGroup(
  player: Player,
  activities: readonly ActivityDefinition[]
): ShellActionGroup | null {
  const recoverActivity = activities.find((activity) => activity.id === RECOVER_ACTIVITY_ID);
  const availability = player.activityState?.availability?.[RECOVER_ACTIVITY_ID];

  if (!recoverActivity || !availability || availability.status !== "disabled") {
    return null;
  }

  return {
    label: "Recovery",
    tone: "activity",
    choices: [
      {
        id: `${ACTIVITY_ACTION_PREFIX}${recoverActivity.id}`,
        label: recoverActivity.name,
        disabled: true,
        disabledReason: availability.disabledReason
      }
    ]
  };
}
