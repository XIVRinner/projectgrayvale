import { Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
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
      [version]="version"
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
  private readonly creatorOptionsLoader = inject(CharacterCreatorOptionsLoader);
  private readonly gameSettings = inject(GameSettingsService);

  protected readonly isCharacterCreationOpenState = signal(false);
  protected readonly isSaveManagerOpen = signal(false);
  protected readonly transferPayload = signal("");
  protected readonly transferStatusMessage = signal<string | null>(null);
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

  readonly statusItems = signal<readonly ShellStatusItem[]>([]);

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

  readonly actionGroups = signal<readonly ShellActionGroup[]>([
    {
      label: "Talk",
      tone: "talk",
      choices: [
        { id: "talk-1", label: "What is this place?" },
        { id: "talk-2", label: "How did you find me?" },
        { id: "talk-3", label: "Where am I in the world?" }
      ]
    },
    {
      label: "Quest",
      tone: "quest",
      choices: [
        { id: "quest-1", label: "I can stand. Let me try." }
      ]
    }
  ]);

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
}

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
