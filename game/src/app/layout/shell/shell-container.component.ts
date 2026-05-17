import { Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { type Player, type Race } from "@rinner/grayvale-core";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { AdminAuthStatusService } from "../../core/services/admin-auth-status.service";
import { ActivityService } from "../../core/services/activity.service";
import { CombatEncounterService } from "../../features/combat/combat-encounter.service";
import { ChangelogService } from "../../features/changelog/changelog.service";
import type { ChangelogRelease } from "../../features/changelog/changelog.types";
import {
  PlayerProfileApiService,
  type PlayerProfileData,
} from "../../features/player-profile/player-profile-api.service";
import { GameDialogService } from "../../core/services/game-dialog.service";
import { DebugLogService } from "../../core/services/game-log/debug-log.service";
import { GameplayLogService } from "../../core/services/game-log/gameplay-log.service";
import { GameQuestService } from "../../core/services/game-quest.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
import {
  formatServerChatHelp,
  resolveServerModerationCommand,
  resolveServerChatCommand,
  resolveWhisperCommand,
} from "../../core/services/server-chat-commands";
import { ServerChatService } from "../../core/services/server-chat.service";
import { ServerConnectionService } from "../../core/services/server-connection.service";
import { GuildService } from "../../core/services/guild.service";
import { SocialService } from "../../core/services/social.service";
import { PlayerIdentityService } from "../../core/services/player-identity.service";
import type {
  ServerChatPlayerActionRequest,
  ServerRelayProfileView,
  ServerModerationRequest,
  ServerPresencePlayerView,
} from "../../core/services/server-chat.models";
import {
  healthStatesEqual,
  PLAYER_HEALTH_BALANCE_PROFILE_ID,
  reconcileHealthState,
} from "../../core/services/health-balance";
import { WorldStateService } from "../../core/services/world-state.service";
import { GameplayGraphRuntime } from "../../core/execution-graph/gameplay-graph-runtime.service";
import {
  CharacterCreatorOptions,
  CharacterCreatorOptionsLoader,
} from "../../data/loaders/character-creator-options.loader";

import {
  buildShellCharacterPanel,
  ShellCharacterMetadata,
} from "./shell-character-panel.mapper";
import {
  buildQuestTrackerPanel,
  buildQuestViewModels,
  DEFAULT_TRACKED_QUEST_COUNT,
  resolveTrackedQuestIds,
} from "./shell-quest.mapper";
import { ShellViewComponent } from "./shell-view.component";
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
      [whatsNewUnreadCount]="whatsNewUnreadCount()"
      [canOpenKairosEdit]="canOpenKairosEdit()"
      [isKairosEditOpen]="isKairosEditOpen()"
      [isWhatsNewOpen]="isWhatsNewOpen()"
      [whatsNewReleases]="whatsNewReleases()"
      [isWhatsNewLoading]="whatsNewLoading()"
      [whatsNewErrorMessage]="whatsNewErrorMessage()"
      [actionGroups]="actionGroups()"
      [characterPanel]="characterPanel()"
      [questTrackerPanel]="questTrackerPanel()"
      [miniChatPanel]="miniChatPanel()"
      [questLogQuests]="questViewModels()"
      [trackedQuestIds]="effectiveTrackedQuestIds()"
      [saveSlots]="saveSlots()"
      [isCharacterSheetOpen]="isCharacterSheetOpen()"
      [isCharacterCreationOpen]="isCharacterCreationOpen()"
      [isCharacterCreationRequired]="isCharacterCreationRequired()"
      [isSaveManagerOpen]="isSaveManagerOpen()"
      [isGameplayLogOpen]="isGameplayLogOpen()"
      [isQuestLogOpen]="isQuestLogOpen()"
      [isGegVisualizerOpen]="isGegVisualizerOpen()"
      [gameplayLogEntries]="gameplayLogEntries()"
      [debugLogEntries]="debugLogEntries()"
      [gegDebugSnapshot]="gegDebugSnapshot()"
      [transferPayload]="transferPayload()"
      [transferStatusMessage]="transferStatusMessage()"
      [servers]="servers()"
      [selectedServerId]="selectedServerId()"
      [activePlayerUuid]="activePlayerUuid()"
      [activeCharacterLabel]="activeCharacterLabel()"
      [serverStatusMessage]="serverStatusMessage()"
      [serverProfile]="serverProfile()"
      [isServerSelectOpen]="isServerSelectOpen()"
      [isServerJoinConfirmationOpen]="isServerJoinConfirmationOpen()"
      [isServerChatOpen]="isServerChatOpen()"
      [isServerAdminOpen]="isServerAdminOpen()"
      [serverFooterSummary]="serverChat.footerSummary()"
      [serverChatPanel]="serverChat.panel()"
      [serverRelayProfile]="serverRelayProfile()"
      [serverChatPlayers]="serverChat.players()"
      [serverChatMessages]="serverChat.messages()"
      [serverChatCustomEmojis]="serverChat.customEmojis()"
      [serverChatCommands]="serverChat.commands()"
      [currentServerChatPlayerUuid]="serverChat.currentPlayerUuid()"
      [selectedModerationPlayer]="selectedModerationPlayer()"
      [serverChatStatusMessage]="serverChat.statusMessage()"
      [serverAdminStatusMessage]="serverAdminStatusMessage()"
      [serverModerationStatusMessage]="serverModerationStatusMessage()"
      [serverChatSendHint]="serverChat.sendHint()"
      [canSendServerChat]="serverChat.canSend()"
      [canModerateServerChat]="serverChat.canModerate()"
      [canBlockServerEntry]="serverChat.canBlockServerEntry()"
      [isServerChatSending]="serverChat.isSending()"
      [isServerAdminSubmitting]="isServerAdminSubmitting()"
      [isServerModerationSubmitting]="isServerModerationSubmitting()"
      [canShowAdminPanel]="serverChat.canShowAdminPanel()"
      [adminEntries]="serverChat.adminEntries()"
      [adminTotal]="serverChat.adminTotal()"
      [adminPage]="serverChat.adminPage()"
      [adminPageSize]="serverChat.adminPageSize()"
      [adminSearch]="serverChat.adminSearch()"
      [adminLoading]="serverChat.adminLoading()"
      [selectedAdminProfileId]="serverChat.selectedAdminProfileId()"
      [adminProfileDetail]="serverChat.adminProfileDetail()"
      [grantablePermissions]="serverChat.grantablePermissions()"
      [socialPlayers]="serverChat.socialPlayers()"
      [socialPlayersTotal]="serverChat.socialPlayersTotal()"
      [socialPlayersPage]="serverChat.socialPlayersPage()"
      [socialPlayersPageSize]="serverChat.socialPlayersPageSize()"
      [socialPlayersSearch]="serverChat.socialPlayersSearch()"
      [socialPlayersLoading]="serverChat.socialPlayersLoading()"
      [friendships]="serverChat.friendships()"
      [friendsLoading]="serverChat.friendsLoading()"
      [currentGuild]="serverChat.currentGuild()"
      [guildInvitations]="serverChat.guildInvitations()"
      [guildLoading]="serverChat.guildLoading()"
      [gameDialogSession]="gameDialog.session()"
      [version]="version"
      (actionSelected)="handleActionSelected($event)"
      (characterPanelActionSelected)="
        handleCharacterPanelActionSelected($event)
      "
      (topbarActionSelected)="handleTopbarActionSelected($event)"
      (whatsNewOpenRequested)="openWhatsNew()"
      (whatsNewCloseRequested)="closeWhatsNew()"
      (whatsNewMarkReadRequested)="markWhatsNewAsRead()"
      (gameDialogAdvanceRequested)="advanceGameDialog()"
      (gameDialogChoiceSelected)="chooseGameDialogOption($event)"
      (gameDialogCloseRequested)="handleGameDialogCloseRequested()"
      (characterSheetCloseRequested)="closeCharacterSheet()"
      (characterCreationOpenRequested)="openCharacterCreation()"
      (characterCreationCloseRequested)="closeCharacterCreation()"
      (characterCreated)="handleCharacterCreated()"
      (saveManagerOpenRequested)="openSaveManager()"
      (saveManagerCloseRequested)="closeSaveManager()"
      (gameplayLogCloseRequested)="closeGameplayLog()"
      (questLogOpenRequested)="openQuestLog()"
      (questLogCloseRequested)="closeQuestLog()"
      (kairosEditRequested)="openKairosEdit()"
      (kairosEditCloseRequested)="closeKairosEdit()"
      (trackedQuestIdsChanged)="setTrackedQuestIds($event)"
      (gegVisualizerOpenRequested)="openGegVisualizer()"
      (gegVisualizerCloseRequested)="closeGegVisualizer()"
      (saveSlotLoadRequested)="loadSlot($event)"
      (saveSlotDeleteRequested)="deleteSlot($event)"
      (saveSlotExportRequested)="exportSlot($event)"
      (saveExportAllRequested)="exportAllSlots()"
      (saveImportRequested)="importSlots()"
      (saveResetRequested)="resetAllSlots()"
      (saveTransferPayloadChanged)="setTransferPayload($event)"
      (serverSelectCloseRequested)="closeServerSelect()"
      (serverInfoRequested)="openServerChat()"
      (serverChatCloseRequested)="closeServerChat()"
      (serverAdminCloseRequested)="closeServerAdminDialog()"
      (serverChanged)="selectServer($event)"
      (serverAdded)="addServer($event)"
      (serverConnectRequested)="connectServer($event.password)"
      (serverJoinConfirmationCloseRequested)="stayOfflineAfterServerJoinConfirmation()"
      (serverJoinCurrentRequested)="joinCurrentServerAfterConfirmation()"
      (serverChooseDifferentRequested)="chooseDifferentServerAfterConfirmation()"
      (serverStayOfflineRequested)="stayOfflineAfterServerJoinConfirmation()"
      (serverChatRefreshRequested)="refreshServerChat()"
      (serverChatGrantAdminRequested)="openServerAdminDialog()"
      (serverChatModeratePlayerRequested)="openServerModerationDialog($event)"
      (serverChatChannelSelected)="selectServerChatChannel($event)"
      (serverChatPlayerActionRequested)="handleServerChatPlayerAction($event)"
      (adminSearchChanged)="setAdminSearch($event)"
      (adminPageChanged)="setAdminPage($event)"
      (adminProfileSelected)="selectAdminProfile($event)"
      (adminPermissionGranted)="grantAdminPermission($event)"
      (adminPermissionRevoked)="revokeAdminPermission($event)"
      (adminModerationRequested)="handleAdminModerationRequest($event)"
      (adminNoteAdded)="addAdminNote($event)"
      (socialPlayersSearchChanged)="setSocialPlayersSearch($event)"
      (socialPlayersPageChanged)="setSocialPlayersPage($event)"
      (friendAddCharacterRequested)="addCharacterFriend($event)"
      (friendAddProfileRequested)="addProfileFriend($event)"
      (friendAcceptRequested)="acceptFriendRequest($event)"
      (friendRejectRequested)="rejectFriendRequest($event)"
      (friendshipRemoveRequested)="removeFriendship($event)"
      (guildCreateRequested)="createGuild($event)"
      (guildInviteRequested)="inviteGuildMember($event)"
      (guildInvitationResponded)="respondGuildInvitation($event)"
      (guildRoleChanged)="changeGuildRole($event)"
      (guildLeaveRequested)="leaveGuild($event)"
      (channelLeaveRequested)="leaveCustomChannel($event)"
      (channelCloseRequested)="closeDirectConversation($event)"
      (channelDestroyRequested)="destroyCustomChannel($event)"
      (serverAdminSubmitted)="submitServerAdminDialog($event)"
      (serverModerationSubmitted)="submitServerModeration($event)"
      (serverModerationCleared)="closeServerModerationDialog()"
      (serverChatSendRequested)="sendServerChatMessage($event)"
      (serverChatServerSelectRequested)="openServerSelectFromChat()"
    />
  `,
})
export class ShellContainerComponent {
  private readonly router = inject(Router);
  private readonly roster = inject(CharacterRosterService);
  private readonly adminAuthStatus = inject(AdminAuthStatusService);
  private readonly creatorOptionsLoader = inject(CharacterCreatorOptionsLoader);
  protected readonly gameDialog = inject(GameDialogService);
  private readonly activityService = inject(ActivityService);
  private readonly combatEncounter = inject(CombatEncounterService);
  private readonly changelogService = inject(ChangelogService);
  private readonly playerProfileApi = inject(PlayerProfileApiService);
  private readonly debugLog = inject(DebugLogService);
  private readonly gameplayLog = inject(GameplayLogService);
  private readonly gameQuests = inject(GameQuestService);
  private readonly gameSettings = inject(GameSettingsService);
  private readonly worldState = inject(WorldStateService);
  private readonly gameplayRuntime = inject(GameplayGraphRuntime);
  private readonly serverConnection = inject(ServerConnectionService);
  private readonly guildService = inject(GuildService);
  private readonly socialService = inject(SocialService);
  private readonly playerIdentity = inject(PlayerIdentityService);
  protected readonly serverChat = inject(ServerChatService);

  protected readonly isCharacterCreationOpenState = signal(false);
  protected readonly isCharacterSheetOpen = signal(false);
  protected readonly isSaveManagerOpen = signal(false);
  protected readonly isGameplayLogOpen = signal(false);
  protected readonly isQuestLogOpen = signal(false);
  protected readonly isGegVisualizerOpen = signal(false);
  protected readonly isKairosEditOpen = signal(false);
  protected readonly isWhatsNewOpen = signal(false);
  protected readonly isServerSelectOpen = signal(
    shouldShowServerSelectOnStartup(),
  );
  protected readonly isServerJoinConfirmationOpen = signal(false);
  protected readonly isServerChatOpen = signal(false);
  protected readonly isServerAdminOpen = signal(false);
  protected readonly transferPayload = signal("");
  protected readonly transferStatusMessage = signal<string | null>(null);
  protected readonly serverStatusMessage = signal<string | null>(null);
  protected readonly serverAdminStatusMessage = signal<string | null>(null);
  protected readonly serverModerationStatusMessage = signal<string | null>(null);
  protected readonly isServerAdminSubmitting = signal(false);
  protected readonly isServerModerationSubmitting = signal(false);
  protected readonly whatsNewLoading = signal(false);
  protected readonly whatsNewErrorMessage = signal<string | null>(null);
  protected readonly whatsNewReleases = signal<readonly ChangelogRelease[]>([]);
  protected readonly whatsNewUnreadCount = signal(0);
  protected readonly selectedModerationPlayer =
    signal<ServerPresencePlayerView | null>(null);
  protected readonly relayProfileState = signal<PlayerProfileData | null>(null);
  protected readonly trackedQuestIdsState = signal<readonly string[]>([]);
  private readonly creatorOptions = signal<CharacterCreatorOptions | null>(
    null,
  );
  protected readonly gameplayLogEntries = toSignal(this.gameplayLog.log$, {
    initialValue: [],
  });
  protected readonly debugLogEntries = toSignal(this.debugLog.entries$, {
    initialValue: [],
  });
  private readonly debugErrorCount = toSignal(this.debugLog.errorCount$, {
    initialValue: 0,
  });

  readonly version = "0.0.1";
  readonly canOpenKairosEdit = this.adminAuthStatus.canOpenKairosEdit;

  readonly title = signal("@Gray Vale");
  readonly subtitle = computed(() => {
    const activeCharacter = this.roster.activeCharacter();

    if (!activeCharacter) {
      return "Playing as No Active Character";
    }

    return `Playing as Level ${activeCharacter.progression.level} ${activeCharacter.name}`;
  });

  readonly layoutPreset = signal<ShellLayoutPreset>("command-center");

  readonly isCharacterCreationRequired = computed(
    () => this.saveSlots().length === 0,
  );

  readonly isCharacterCreationOpen = computed(
    () =>
      this.isCharacterCreationRequired() || this.isCharacterCreationOpenState(),
  );

  readonly navItems = signal<readonly ShellNavItem[]>([
    { label: "Creator Lab", route: "/creator" },
    { label: "Changelog", route: "/changelog" },
    { label: "Profile", route: "/profile" },
  ]);

  readonly statusItems = computed<readonly ShellStatusItem[]>(() => {
    const items: ShellStatusItem[] = [];
    const locationLabel = this.worldState.currentLocationLabel();
    const sublocationLabel = this.worldState.currentSublocationLabel();

    if (locationLabel) {
      items.push({
        label: "Location",
        value: locationLabel,
      });
    }

    if (sublocationLabel) {
      items.push({
        label: "Sublocation",
        value: sublocationLabel,
      });
    }

    return items;
  });

  readonly characterMetadata = computed<ShellCharacterMetadata>(() => {
    const options = this.creatorOptions();

    return {
      racesById: new Map(options?.races.map((race) => [race.id, race]) ?? []),
      classesById: new Map(
        options?.classes.map((option) => [option.id, option]) ?? [],
      ),
      attributesById: this.gameSettings.attributesById(),
      skillsById: this.gameSettings.skillsById(),
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
        },
      });

    effect(() => {
      if (!this.isCharacterCreationRequired()) {
        return;
      }

      this.isCharacterSheetOpen.set(false);
      this.isCharacterCreationOpenState.set(true);
      this.isSaveManagerOpen.set(false);
    });

    effect(() => {
      if (!this.canOpenKairosEdit() && this.isKairosEditOpen()) {
        this.isKairosEditOpen.set(false);
      }
    });

    effect(() => {
      const activeSlot = this.roster.activeSlot();
      const healthProfile =
        this.gameSettings.balanceProfileFor(PLAYER_HEALTH_BALANCE_PROFILE_ID) ??
        undefined;

      if (!activeSlot || !healthProfile) {
        return;
      }

      const reconciledHealth = reconcileHealthState(
        activeSlot.player,
        activeSlot.health,
        healthProfile,
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

    effect(() => {
      const selectedPlayer = this.selectedModerationPlayer();

      if (!selectedPlayer) {
        return;
      }

      const refreshedPlayer =
        this.serverChat
          .players()
          .find((player) => player.profileId === selectedPlayer.profileId) ??
        null;

      if (!refreshedPlayer) {
        this.selectedModerationPlayer.set(null);
        return;
      }

      if (refreshedPlayer !== selectedPlayer) {
        this.selectedModerationPlayer.set(refreshedPlayer);
      }
    });

    effect(() => {
      this.serverConnection.selectedServerId();
      this.serverConnection.session();
      queueMicrotask(() => void this.refreshWhatsNewUnreadCount());
    });
  }

  readonly saveSlots = computed<readonly ShellSaveSlotSummary[]>(() => {
    const activeSlotId = this.roster.activeSlotId();
    const racesById = new Map(
      this.creatorOptions()?.races.map((race) => [race.id, race]) ?? [],
    );

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
      isActive: slot.id === activeSlotId,
    }));
  });

  readonly saveSummary = computed<ShellTopbarSaveSummary>(() => {
    const activeSlot = this.roster.activeSlot();

    if (!activeSlot) {
      return {
        lead: "No Active Character",
        lastSaved: "—",
      };
    }

    return {
      lead: activeSlot.player.name,
      characterName: activeSlot.player.name,
      lastSaved: formatSaveTimestamp(activeSlot.updatedAt),
    };
  });

  readonly topbarActions = computed<readonly ShellTopbarAction[]>(() => {
    const errorCount = this.debugErrorCount();

    return [
      {
        id: TOPBAR_GAMEPLAY_LOG_ACTION_ID,
        label: "Gameplay Log",
        icon: "pi pi-list",
        badge: errorCount > 0 ? errorCount : undefined,
        tone: "default",
      },
      // GAP: AchievementModalService not yet available
      {
        id: TOPBAR_ACHIEVEMENTS_ACTION_ID,
        label: "Achievements",
        icon: "pi pi-trophy",
        tone: "accent",
        disabled: true,
      },
      // GAP: WikiModalService not yet available
      {
        id: TOPBAR_GALLERY_ACTION_ID,
        label: "Gallery",
        icon: "pi pi-images",
        tone: "cool",
        disabled: true,
      },
      {
        id: TOPBAR_SETTINGS_ACTION_ID,
        label: "Settings",
        icon: "pi pi-cog",
        tone: "default",
      },
    ];
  });

  readonly actionGroups = computed<readonly ShellActionGroup[]>(() =>
    this.gameplayRuntime.actionGroups(),
  );

  readonly servers = this.serverConnection.servers;

  readonly selectedServerId = this.serverConnection.selectedServerId;

  readonly serverProfile = this.serverConnection.serverProfile;

  readonly activePlayerUuid = computed(
    () => this.roster.activeCharacter()?.id ?? null,
  );

  readonly activeCharacterLabel = computed(() => {
    const activeCharacter = this.roster.activeCharacter();

    if (!activeCharacter) {
      return null;
    }

    return `${activeCharacter.name} · Level ${activeCharacter.progression.level}`;
  });

  readonly gegDebugSnapshot = computed(() =>
    this.gameplayRuntime.debugSnapshot(),
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
      this.gameSettings.balanceProfileFor(PLAYER_HEALTH_BALANCE_PROFILE_ID) ??
        undefined,
      this.gameSettings.difficultyCurveFor(difficultyMode) ?? undefined,
    );
  });

  readonly questViewModels = computed(() =>
    buildQuestViewModels(
      this.gameQuests.authoredQuests(),
      this.roster.activeCharacter()?.questLog,
    ),
  );

  readonly effectiveTrackedQuestIds = computed(() =>
    resolveTrackedQuestIds(
      this.questViewModels(),
      this.trackedQuestIdsState(),
      DEFAULT_TRACKED_QUEST_COUNT,
    ),
  );

  readonly questTrackerPanel = computed<ShellQuestTrackerPanel>(() =>
    buildQuestTrackerPanel(
      this.questViewModels(),
      this.gameQuests.runtimeStates(),
      this.effectiveTrackedQuestIds(),
      DEFAULT_TRACKED_QUEST_COUNT,
    ),
  );

  readonly miniChatPanel = computed<ShellMiniChatPanel>(() => {
    const messages = this.serverChat
      .messages()
      .slice(-10)
      .map((message) => ({
        id: String(message.id),
        sender: message.displayName ?? "Unknown",
        text: message.message,
        tone: toMiniChatTone(message.rank),
        timestamp: new Date(message.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));

    return {
      title: "World Chat",
      emptyLabel: "No world chat messages yet.",
      messages,
    };
  });

  readonly serverRelayProfile = computed<ServerRelayProfileView | null>(() => {
    const profile = this.relayProfileState();

    if (!profile) {
      return null;
    }

    return {
      profileId: profile.id,
      playerUuid: this.serverChat.currentPlayerUuid(),
      displayName: profile.displayName?.trim() || profile.id,
      characters: profile.characters.map((entry) => ({
        id: entry.id,
        name: entry.name,
      })),
      friendships: this.serverChat.friendships(),
    };
  });

  protected openCharacterCreation(): void {
    this.logUi("Opening character creation dialog.");
    this.closeServerChat();
    this.transferStatusMessage.set(null);
    this.isCharacterSheetOpen.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isCharacterCreationOpenState.set(true);
  }

  protected openCharacterSheet(): void {
    if (!this.roster.activeCharacter()) {
      this.logUi(
        "Ignored character sheet open because there is no active character.",
      );
      return;
    }

    this.logUi("Opening character sheet dialog.");
    this.closeServerChat();
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isCharacterSheetOpen.set(true);
  }

  protected closeCharacterSheet(): void {
    this.logUi("Closing character sheet dialog.");
    this.isCharacterSheetOpen.set(false);
  }

  protected closeCharacterCreation(): void {
    if (this.isCharacterCreationRequired()) {
      this.logUi(
        "Ignored character creation close because a character is still required.",
      );
      return;
    }

    this.logUi("Closing character creation dialog.");
    this.isCharacterCreationOpenState.set(false);
  }

  protected async handleCharacterCreated(): Promise<void> {
    this.logUi("Character creation completed.");
    this.isCharacterCreationOpenState.set(false);

    if (!this.serverConnection.isConnected()) {
      this.transferStatusMessage.set(
        "Character created locally. Connect to a server to register it there.",
      );
      return;
    }

    this.closeServerChat();
    this.transferStatusMessage.set(
      "Character created locally. Confirm before joining this server.",
    );
    this.serverStatusMessage.set(
      "Confirm whether this character should join the current server. A valid cookie session can be used after consent.",
    );
    this.isServerSelectOpen.set(false);
    this.isServerJoinConfirmationOpen.set(true);
  }

  protected openSaveManager(): void {
    this.logUi("Opening save manager.");
    this.closeServerChat();
    this.isCharacterSheetOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
    this.isGameplayLogOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isSaveManagerOpen.set(true);
    this.transferStatusMessage.set(null);
  }

  protected closeSaveManager(): void {
    this.logUi("Closing save manager.");
    this.isSaveManagerOpen.set(false);
  }

  protected openKairosEdit(): void {
    if (!this.canOpenKairosEdit()) {
      return;
    }

    this.logUi("Opening Kairos Edit dialog.");
    this.isKairosEditOpen.set(true);
  }

  protected closeKairosEdit(): void {
    if (!this.isKairosEditOpen()) {
      return;
    }

    this.logUi("Closing Kairos Edit dialog.");
    this.isKairosEditOpen.set(false);
  }

  protected openServerSelect(): void {
    this.logUi("Opening server select.");
    this.closeServerChat();
    this.isServerJoinConfirmationOpen.set(false);
    this.isServerSelectOpen.set(true);
    persistServerSelectPreference(true);
  }

  protected closeServerSelect(): void {
    this.logUi("Closing server select.");
    this.isServerSelectOpen.set(false);
    persistServerSelectPreference(false);
  }

  protected async joinCurrentServerAfterConfirmation(): Promise<void> {
    const activeCharacter = this.roster.activeCharacter();

    if (!activeCharacter) {
      this.serverStatusMessage.set("Create or load a character before joining a server.");
      this.isServerJoinConfirmationOpen.set(false);
      return;
    }

    this.isServerJoinConfirmationOpen.set(false);

    try {
      this.serverStatusMessage.set("Checking current server cookie...");
      await this.serverConnection.restoreSessionFromCookie();
      await this.ensureServerCharacterRegistered(activeCharacter);
      this.serverStatusMessage.set(
        "Joined current server with this character using the current cookie session.",
      );
      await this.refreshRelayProfile();
      this.logUi("Joined current server after character confirmation.");
    } catch (error) {
      const message = errorToMessage(error);
      this.serverStatusMessage.set(
        `${message} Cookie session could not be used. Choose another server or enter this server's password to connect.`,
      );
      this.openServerSelect();
      this.logUi("Joining current server after confirmation failed.", message, "error");
    }
  }

  protected chooseDifferentServerAfterConfirmation(): void {
    this.isServerJoinConfirmationOpen.set(false);
    this.serverStatusMessage.set("Choose a server for this character.");
    this.openServerSelect();
  }

  protected stayOfflineAfterServerJoinConfirmation(): void {
    this.logUi("Staying offline after server join confirmation.");
    this.isServerJoinConfirmationOpen.set(false);
    this.serverStatusMessage.set("Character remains local. Join a server when ready.");
  }

  protected openServerChat(): void {
    this.logUi("Opening server relay dialog.");
    this.isCharacterSheetOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isServerChatOpen.set(true);
    this.serverChat.openPanel();
    void this.refreshRelayProfile();
  }

  protected closeServerChat(): void {
    if (!this.isServerChatOpen()) {
      return;
    }

    this.logUi("Closing server relay dialog.");
    this.closeServerAdminDialog();
    this.closeServerModerationDialog();
    this.isServerChatOpen.set(false);
    this.serverChat.closePanel();
  }

  protected refreshServerChat(): void {
    this.logUi("Refreshing server relay data.");
    void this.serverChat.refreshAll();
    void this.refreshRelayProfile();
  }

  protected selectServerChatChannel(channelId: string): void {
    this.serverChat.selectChannel(channelId);
  }

  protected setAdminSearch(search: string): void {
    this.serverChat.setAdminSearch(search);
  }

  protected setAdminPage(page: number): void {
    this.serverChat.setAdminPage(page);
  }

  protected selectAdminProfile(profileId: string): void {
    this.serverChat.selectAdminProfile(profileId);
  }

  protected setSocialPlayersSearch(search: string): void {
    this.serverChat.setSocialPlayersSearch(search);
  }

  protected setSocialPlayersPage(page: number): void {
    this.serverChat.setSocialPlayersPage(page);
  }

  protected async addCharacterFriend(input: {
    profileId: string;
    characterId?: string;
  }): Promise<void> {
    if (!input.profileId.trim()) {
      return;
    }
    try {
      await this.serverChat.addCharacterFriend(input.profileId.trim(), input.characterId);
      this.serverChat.showStatusMessage("Character friend added.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async addProfileFriend(profileId: string): Promise<void> {
    if (!profileId.trim()) {
      return;
    }
    try {
      await this.serverChat.requestProfileFriend(profileId.trim());
      this.serverChat.showStatusMessage("Profile friend request sent.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async acceptFriendRequest(friendshipId: string): Promise<void> {
    try {
      await this.serverChat.acceptFriendRequest(friendshipId);
      this.serverChat.showStatusMessage("Friend request accepted.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async rejectFriendRequest(friendshipId: string): Promise<void> {
    try {
      await this.serverChat.rejectFriendRequest(friendshipId);
      this.serverChat.showStatusMessage("Friend request rejected.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async removeFriendship(friendshipId: string): Promise<void> {
    try {
      await this.serverChat.removeFriendship(friendshipId);
      this.serverChat.showStatusMessage("Friend removed.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async createGuild(input: {
    name: string;
    shortName: string;
  }): Promise<void> {
    if (!input.name.trim() || !input.shortName.trim()) {
      return;
    }
    try {
      await this.serverChat.createGuild({
        name: input.name.trim(),
        shortName: input.shortName.trim().toUpperCase(),
      });
      this.serverChat.showStatusMessage("Guild created.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async inviteGuildMember(input: {
    guildId: string;
    targetProfileId: string;
  }): Promise<void> {
    if (!input.targetProfileId.trim()) {
      return;
    }
    try {
      await this.serverChat.inviteToGuild(input.guildId, input.targetProfileId.trim());
      this.serverChat.showStatusMessage("Guild invitation sent.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async respondGuildInvitation(input: {
    invitationId: string;
    accept: boolean;
  }): Promise<void> {
    try {
      await this.serverChat.respondGuildInvitation(input.invitationId, input.accept);
      this.serverChat.showStatusMessage(input.accept ? "Guild invitation accepted." : "Guild invitation rejected.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async changeGuildRole(input: {
    guildId: string;
    characterId: string;
    role: "guild_master" | "officer" | "member" | "recruit";
  }): Promise<void> {
    try {
      await this.serverChat.setGuildMemberRole(input.guildId, input.characterId, input.role);
      this.serverChat.showStatusMessage("Guild member role updated.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async leaveGuild(guildId: string): Promise<void> {
    try {
      await this.serverChat.leaveGuild(guildId);
      this.serverChat.showStatusMessage("Left guild.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async leaveCustomChannel(channelId: string): Promise<void> {
    try {
      await this.serverChat.leaveCustomChannel(channelId);
      this.serverChat.showStatusMessage("Left channel.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async closeDirectConversation(conversationId: string): Promise<void> {
    try {
      await this.serverChat.closeDirectConversation(conversationId);
      this.serverChat.showStatusMessage("Conversation closed.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async destroyCustomChannel(channelId: string): Promise<void> {
    try {
      await this.serverChat.destroyCustomChannel(channelId);
      this.serverChat.showStatusMessage("Channel destroyed.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async grantAdminPermission(input: {
    profileId: string;
    permissionId: string;
  }): Promise<void> {
    try {
      await this.serverChat.grantProfilePermission(input.profileId, input.permissionId);
      this.serverChat.showStatusMessage(`Granted ${input.permissionId}.`);
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async revokeAdminPermission(input: {
    profileId: string;
    permissionId: string;
  }): Promise<void> {
    try {
      await this.serverChat.revokeProfilePermission(input.profileId, input.permissionId);
      this.serverChat.showStatusMessage(`Revoked ${input.permissionId}.`);
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async handleAdminModerationRequest(input: {
    profileId: string;
    action: "kick" | "ban" | "unban" | "mute" | "unmute" | "warn";
  }): Promise<void> {
    try {
      await this.serverChat.moderateProfile(input.profileId, input.action);
      this.serverChat.showStatusMessage(`Applied ${input.action} on profile.`);
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async addAdminNote(input: { profileId: string; body: string }): Promise<void> {
    try {
      await this.serverChat.addAdminNote(input.profileId, input.body);
      this.serverChat.showStatusMessage("Admin note added.");
    } catch (error) {
      this.serverChat.showStatusMessage(errorToMessage(error));
    }
  }

  protected async handleServerChatPlayerAction(
    request: ServerChatPlayerActionRequest,
  ): Promise<void> {
    if (request.action === "whisper") {
      if (!request.targetProfileId.trim()) {
        this.serverChat.showStatusMessage(
          "Whisper target is unavailable right now.",
        );
        return;
      }

      try {
        await this.serverChat.openDirectConversation(request.targetProfileId);
        this.serverChat.showStatusMessage(
          request.targetCharacterName?.trim()
            ? `Opened whisper with ${request.targetCharacterName.trim()}.`
            : "Opened direct conversation.",
        );
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    if (request.action === "friend_profile") {
      try {
        await this.serverChat.requestProfileFriend(request.targetProfileId);
        this.serverChat.showStatusMessage("Profile friend request sent.");
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    if (request.action === "friend_character") {
      try {
        await this.serverChat.addCharacterFriend(request.targetProfileId);
        this.serverChat.showStatusMessage("Character friend added.");
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    if (request.action === "block") {
      try {
        await this.socialService.blockProfile(request.targetProfileId);
        this.serverChat.showStatusMessage("Player blocked.");
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    if (request.action === "ban" && this.serverChat.canModerate()) {
      const targetPlayerUuid =
        request.targetPlayerUuid ?? request.targetProfileId;
      const player = this.serverChat
        .players()
        .find(
          (entry) =>
            (entry.characterId ?? entry.profileId) === targetPlayerUuid ||
            entry.profileId === request.targetProfileId,
        );

      if (player) {
        this.openServerModerationDialog(player);
      }
      return;
    }

    if ((request.action === "kick" || request.action === "mute") && this.serverChat.canModerate()) {
      this.serverChat.showStatusMessage(
        "Kick and mute actions are routed through the moderation panel right now.",
      );
      return;
    }

    if (request.action === "report") {
      try {
        await this.socialService.reportPlayer({
          targetProfileId: request.targetProfileId,
          reason: "Reported from shell chat context action.",
        });
        this.serverChat.showStatusMessage("Report submitted.");
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    if (request.action === "guild_invite" && request.targetProfileId) {
      try {
        const guildResponse = await this.guildService.loadCurrentGuild();

        if (!guildResponse.guild?.guildId) {
          this.serverChat.showStatusMessage("Join or create a guild before inviting.");
          return;
        }

        await this.guildService.inviteToGuild(guildResponse.guild.guildId, {
          targetProfileId: request.targetProfileId,
        });
        this.serverChat.showStatusMessage("Guild invitation sent.");
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    if (request.action === "admin_profile" && this.serverChat.canModerate()) {
      try {
        this.serverChat.selectAdminProfile(request.targetProfileId);
        await this.serverChat.refreshAdminPanel();
        this.serverChat.showStatusMessage("Loaded admin profile detail.");
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
    }
  }

  protected async sendServerChatMessage(message: string): Promise<void> {
    this.logUi("Sending server chat message.");
    const moderationCommand = resolveServerModerationCommand(message);

    if (moderationCommand) {
      await this.handleServerModerationCommand(moderationCommand);
      return;
    }

    const whisperCommand = resolveWhisperCommand(message);

    if (whisperCommand) {
      try {
        await this.serverChat.sendWhisper(
          whisperCommand.targetCharacterName,
          whisperCommand.body,
        );
        this.serverChat.showStatusMessage(
          `Opened whisper with ${whisperCommand.targetCharacterName}.`,
        );
      } catch (error) {
        this.serverChat.showStatusMessage(errorToMessage(error));
      }
      return;
    }

    const command = resolveServerChatCommand(message);

    if (command) {
      switch (command.id) {
        case "help":
          this.serverChat.showStatusMessage(formatServerChatHelp());
          return;
        case "who":
          this.serverChat.showStatusMessage(
            "Refreshing relay presence and recent messages...",
          );
          await this.serverChat.refreshAll();
          return;
        case "server":
          this.openServerSelectFromChat();
          return;
        case "admin":
          this.openServerAdminDialog();
          return;
      }
    }

    await this.serverChat.sendMessage(message);
  }

  protected openServerSelectFromChat(): void {
    this.logUi("Opening server select from server relay dialog.");
    this.closeServerChat();
    this.openServerSelect();
    this.serverChat.openServerSelectHint();
  }

  protected openServerAdminDialog(): void {
    this.logUi("Opening server admin dialog.");
    this.closeServerModerationDialog();
    this.serverAdminStatusMessage.set(null);
    this.isServerAdminOpen.set(true);
  }

  protected closeServerAdminDialog(): void {
    this.isServerAdminOpen.set(false);
    this.isServerAdminSubmitting.set(false);
  }

  protected openServerModerationDialog(player: ServerPresencePlayerView): void {
    this.logUi("Focusing server moderation target.", {
      profileId: player.profileId,
      characterId: player.characterId,
    });
    this.closeServerAdminDialog();
    this.selectedModerationPlayer.set(player);
    this.serverModerationStatusMessage.set(null);
  }

  protected closeServerModerationDialog(): void {
    this.isServerModerationSubmitting.set(false);
    this.serverModerationStatusMessage.set(null);
    this.selectedModerationPlayer.set(null);
  }

  protected async submitServerAdminDialog(
    adminPassword: string,
  ): Promise<void> {
    await this.grantAdminRights(adminPassword, "relay");
  }

  protected async submitServerModeration(
    request: ServerModerationRequest,
  ): Promise<void> {
    this.isServerModerationSubmitting.set(true);

    try {
      await this.serverChat.moderatePlayer(request);
      this.serverModerationStatusMessage.set("Moderation action applied.");
      const refreshedPlayer =
        this.serverChat
          .players()
          .find((player) => player.profileId === request.targetUuid) ?? null;

      this.selectedModerationPlayer.set(refreshedPlayer);
    } catch (error) {
      const message = errorToMessage(error);
      this.serverModerationStatusMessage.set(message);
      this.logUi("Server moderation failed.", message, "error");
    } finally {
      this.isServerModerationSubmitting.set(false);
    }
  }

  protected selectServer(serverId: string): void {
    this.logUi("Selecting server.", { serverId });
    this.serverConnection.selectServer(serverId);
    this.relayProfileState.set(null);
    this.serverStatusMessage.set(`Selected ${serverId}.`);
  }

  protected addServer(server: {
    host: string;
    port: number;
    clientId: string;
  }): void {
    try {
      this.serverConnection.addServer(
        server.host,
        server.port,
        server.clientId,
      );
      this.serverStatusMessage.set(`Added ${server.host}:${server.port}.`);
      this.logUi("Added server endpoint.", server);
    } catch (error) {
      const message = errorToMessage(error);
      this.serverStatusMessage.set(message);
      this.logUi("Adding server endpoint failed.", message, "error");
    }
  }

  protected async connectServer(password: string): Promise<void> {
    const activeCharacter = this.roster.activeCharacter();
    const profileId = this.playerIdentity.ensureProfileId();

    if (!activeCharacter) {
      this.serverStatusMessage.set(
        "Create or load a character first before connecting a profile.",
      );
      return;
    }

    if (!password.trim()) {
      this.serverStatusMessage.set(
        "Enter a player password before connecting.",
      );
      return;
    }

    try {
      const avatarPath = activeCharacter
        ? resolveSaveSlotPortraitPath(
            activeCharacter,
            this.characterMetadata().racesById,
          )
        : undefined;
      await this.serverConnection.connectPlayer(
        profileId,
        password,
        activeCharacter.name,
        avatarPath,
      );

      await this.ensureServerCharacterRegistered(activeCharacter);

      const updatedSession = this.serverConnection.session();
      this.serverStatusMessage.set(
        updatedSession?.activeCharacterId
          ? `Connected profile ${updatedSession.profileId} as ${updatedSession.rank.toUpperCase()} with ${updatedSession.activeCharacterId} active.`
          : `Connected profile ${updatedSession?.profileId ?? profileId} as ${updatedSession?.rank.toUpperCase() ?? "PLAYER"}.`,
      );
      await this.refreshRelayProfile();
      this.closeServerSelect();
      this.logUi("Connected player to server.", updatedSession);
    } catch (error) {
      const message = errorToMessage(error);
      this.serverStatusMessage.set(message);
      this.logUi("Connecting player to server failed.", message, "error");
    }
  }

  /**
   * Registers the active local character with the current server, then marks it active.
   * Local character creation stays client-owned; the server learns about it on connect.
   */
  private async ensureServerCharacterRegistered(localCharacter: Player): Promise<void> {
    const initialSnapshot = buildInitialCharacterSnapshot(localCharacter);
    const portraitShardId = resolvePortraitShardId(localCharacter);

    if (!portraitShardId) {
      throw new Error("The active character is missing portrait data required for server registration.");
    }

    await this.playerProfileApi.registerCharacter({
      characterId: localCharacter.id,
      characterName: localCharacter.name,
      portraitShardId,
      level: initialSnapshot.level,
      locationId: initialSnapshot.locationId,
      lastLocationName: initialSnapshot.lastLocationName,
    });
    await this.playerProfileApi.registerActiveCharacter({
      characterId: localCharacter.id,
      level: initialSnapshot.level,
      locationId: initialSnapshot.locationId,
      lastLocationName: initialSnapshot.lastLocationName,
    });

    await this.serverConnection.restoreSessionFromCookie();
  }

  private async handleServerModerationCommand(
    parsedCommand: ReturnType<typeof resolveServerModerationCommand>,
  ): Promise<void> {
    if (!parsedCommand) {
      return;
    }

    if (!this.serverChat.canModerate()) {
      this.serverChat.showStatusMessage(
        "Moderation commands require moderator or admin rank on this shard.",
      );
      return;
    }

    const targetPlayer = resolveModerationTarget(
      this.serverChat.players(),
      parsedCommand.targetQuery,
    );

    if (!targetPlayer) {
      this.serverChat.showStatusMessage(
        parsedCommand.targetQuery
          ? `Could not resolve "${parsedCommand.targetQuery}" to one online player.`
          : parsedCommand.usage,
      );
      return;
    }

    if (
      parsedCommand.request.blockServerEntry &&
      !this.serverChat.canBlockServerEntry()
    ) {
      this.serverChat.showStatusMessage(
        "Only admins can escalate a chat ban into a full server-entry ban.",
      );
      return;
    }

    if (
      (parsedCommand.request.action === "timeout" ||
        parsedCommand.request.action === "ban") &&
      (!parsedCommand.request.reason ||
        parsedCommand.request.reason.trim().length < 3)
    ) {
      this.serverChat.showStatusMessage(parsedCommand.usage);
      return;
    }

    if (
      parsedCommand.request.action === "timeout" &&
      (!parsedCommand.request.durationMinutes ||
        parsedCommand.request.durationMinutes <= 0)
    ) {
      this.serverChat.showStatusMessage(parsedCommand.usage);
      return;
    }

    this.openServerModerationDialog(targetPlayer);
    await this.submitServerModeration({
      ...parsedCommand.request,
      targetUuid: targetPlayer.profileId,
    });
  }

  protected async giveAdminRights(adminPassword: string): Promise<void> {
    await this.grantAdminRights(adminPassword, "server-select");
  }

  private async refreshRelayProfile(): Promise<void> {
    if (!this.serverConnection.session()) {
      this.relayProfileState.set(null);
      return;
    }

    try {
      const profile = await this.playerProfileApi.getProfile();
      this.relayProfileState.set(profile);
    } catch {
      this.relayProfileState.set(null);
    }
  }

  private async grantAdminRights(
    adminPassword: string,
    source: "server-select" | "relay",
  ): Promise<void> {
    const profileId = this.playerIdentity.ensureProfileId();

    if (!this.roster.activeCharacter()) {
      const message = "Create or load a character before granting admin.";
      this.serverStatusMessage.set(message);
      this.serverAdminStatusMessage.set(message);
      return;
    }

    if (!adminPassword.trim()) {
      const message = "Enter the server admin password.";
      this.serverStatusMessage.set(message);
      this.serverAdminStatusMessage.set(message);
      return;
    }

    if (source === "relay") {
      this.isServerAdminSubmitting.set(true);
    }

    try {
      const session = await this.serverConnection.grantAdmin(
        profileId,
        adminPassword,
      );
      const message = `Granted profile ${session.profileId} admin rights on the selected server.`;
      this.serverStatusMessage.set(message);
      this.serverAdminStatusMessage.set(message);
      this.logUi("Granted admin rights.", session);
      if (source === "relay") {
        this.closeServerAdminDialog();
      }
    } catch (error) {
      const message = errorToMessage(error);
      this.serverStatusMessage.set(message);
      this.serverAdminStatusMessage.set(message);
      this.logUi("Grant admin rights failed.", message, "error");
    } finally {
      if (source === "relay") {
        this.isServerAdminSubmitting.set(false);
      }
    }
  }

  protected openGameplayLog(): void {
    this.logUi("Opening gameplay log dialog.", {
      gameplayEntries: this.gameplayLogEntries().length,
      debugEntries: this.debugLogEntries().length,
    });
    this.closeServerChat();
    this.isCharacterSheetOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isGameplayLogOpen.set(true);
  }

  protected closeGameplayLog(): void {
    this.logUi("Closing gameplay log dialog.");
    this.isGameplayLogOpen.set(false);
  }

  protected openQuestLog(): void {
    this.logUi("Opening quest log dialog.", {
      questCount: this.questViewModels().length,
      trackedQuestIds: this.effectiveTrackedQuestIds(),
    });
    this.closeServerChat();
    this.isCharacterSheetOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isQuestLogOpen.set(true);
  }

  protected closeQuestLog(): void {
    this.logUi("Closing quest log dialog.");
    this.isQuestLogOpen.set(false);
  }

  protected setTrackedQuestIds(questIds: readonly string[]): void {
    this.logUi("Updated tracked quest ids.", { questIds });
    this.trackedQuestIdsState.set(questIds);
  }

  protected openGegVisualizer(): void {
    this.logUi("Opening GEG visualizer dialog.");
    this.closeServerChat();
    this.isCharacterSheetOpen.set(false);
    this.isCharacterCreationOpenState.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(true);
  }

  protected closeGegVisualizer(): void {
    this.logUi("Closing GEG visualizer dialog.");
    this.isGegVisualizerOpen.set(false);
  }

  protected loadSlot(slotId: string): void {
    this.logUi("Loading save slot.", { slotId });
    const previousCharacterId = this.roster.activeCharacter()?.id ?? null;
    this.roster.setActiveSlot(slotId);
    const nextCharacterId = this.roster.activeCharacter()?.id ?? null;
    this.transferStatusMessage.set(`Loaded ${formatSlotLabel(slotId)}.`);
    this.isCharacterSheetOpen.set(false);
    this.isSaveManagerOpen.set(false);
    this.isGameplayLogOpen.set(false);
    this.isQuestLogOpen.set(false);
    this.isGegVisualizerOpen.set(false);
    this.isCharacterCreationOpenState.set(false);

    if (
      this.serverConnection.isConnected() &&
      previousCharacterId !== null &&
      nextCharacterId !== null &&
      previousCharacterId !== nextCharacterId
    ) {
      this.handleLoadedCharacterChangedWhileConnected();
    }
  }

  private handleLoadedCharacterChangedWhileConnected(): void {
    this.serverConnection.disconnect();
    this.serverStatusMessage.set(
      "Your loaded character changed. Reconnect to a server to join with this character.",
    );
    this.logUi(
      "Disconnected current server session because the loaded local character changed.",
    );
    this.openServerSelect();
  }

  protected deleteSlot(slotId: string): void {
    this.logUi("Deleting save slot.", { slotId });
    const deleted = this.roster.deleteSlot(slotId);

    if (!deleted) {
      this.logUi("Save slot delete failed.", { slotId }, "error");
      this.transferStatusMessage.set(
        `Could not delete ${formatSlotLabel(slotId)}.`,
      );
      return;
    }

    this.logUi("Save slot deleted.", { slotId });
    this.transferStatusMessage.set(`Deleted ${formatSlotLabel(slotId)}.`);
  }

  protected exportSlot(slotId: string): void {
    this.logUi("Exporting save slot.", { slotId });
    const payload = this.roster.exportSlot(slotId);

    if (!payload) {
      this.logUi("Save slot export failed.", { slotId }, "error");
      this.transferStatusMessage.set(
        `Could not export ${formatSlotLabel(slotId)}.`,
      );
      return;
    }

    this.logUi("Save slot exported.", {
      slotId,
      payloadLength: payload.length,
    });
    this.transferPayload.set(payload);
    this.transferStatusMessage.set(
      `Prepared export for ${formatSlotLabel(slotId)}.`,
    );
  }

  protected exportAllSlots(): void {
    const payload = this.roster.exportAll();

    this.logUi("Exporting all save slots.", {
      payloadLength: payload.length,
      slotCount: this.saveSlots().length,
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
        payloadLength: payload.length,
      });
      this.transferStatusMessage.set(`Imported ${importedCount} save slot(s).`);
    } catch (error) {
      this.logUi("Save import failed.", errorToMessage(error), "error");
      this.transferStatusMessage.set(errorToMessage(error));
    }
  }

  protected resetAllSlots(): void {
    this.logUi("Resetting all save slots.", {
      previousSlotCount: this.saveSlots().length,
    });
    this.roster.resetAll();
    this.transferPayload.set("");
    this.transferStatusMessage.set("All save slots were reset.");
  }

  protected setTransferPayload(value: string): void {
    this.logUi("Updated save transfer payload.", {
      payloadLength: value.length,
    });
    this.transferPayload.set(value);
  }

  protected handleActionSelected(actionId: string): void {
    this.logUi("Gameplay action selected.", { actionId });
    const result = this.gameplayRuntime.executeAction(actionId);

    if (!result.ok) {
      this.logUi(
        "Action execution returned a failure.",
        {
          actionId,
          reason: result.reason,
        },
        "error",
      );
    }
  }

  protected handleTopbarActionSelected(actionId: string): void {
    this.logUi("Topbar action selected.", { actionId });
    if (actionId === TOPBAR_GAMEPLAY_LOG_ACTION_ID) {
      this.openGameplayLog();
      return;
    }

    if (actionId === TOPBAR_SETTINGS_ACTION_ID) {
      this.openServerSelect();
    }
  }

  protected openWhatsNew(): void {
    this.logUi("Opening What's New dialog.");
    this.isWhatsNewOpen.set(true);
    void this.loadWhatsNewModal();
  }

  protected closeWhatsNew(): void {
    this.logUi("Closing What's New dialog.");
    const releaseIds = this.unreadWhatsNewReleaseIds();

    this.isWhatsNewOpen.set(false);
    this.whatsNewErrorMessage.set(null);
    void this.markReleaseIdsAsRead(releaseIds);
  }

  protected markWhatsNewAsRead(): void {
    this.logUi("Marking What's New releases as read.");
    const releaseIds = this.unreadWhatsNewReleaseIds();

    this.isWhatsNewOpen.set(false);
    void this.markReleaseIdsAsRead(releaseIds);
  }

  protected handleCharacterPanelActionSelected(actionId: string): void {
    this.logUi("Character panel action selected.", { actionId });

    if (actionId === CHARACTER_PANEL_CHARACTER_SHEET_ACTION_ID) {
      this.openCharacterSheet();
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

  protected handleGameDialogCloseRequested(): void {
    const mode = this.gameDialog.session()?.mode ?? null;
    this.logUi("Game dialog close requested from shell.", { mode });

    if (mode === "activity") {
      this.activityService.stopActivity();
      return;
    }

    if (mode === "combat") {
      this.combatEncounter.closeSummary();
    }
  }

  private async loadWhatsNewModal(): Promise<void> {
    this.whatsNewLoading.set(true);
    this.whatsNewErrorMessage.set(null);

    try {
      const response = await this.changelogService.fetchChangelog({
        limit: 25,
      });
      const releases = response.releases;
      this.whatsNewReleases.set(releases);
      await this.refreshWhatsNewUnreadCount();
    } catch (error) {
      this.whatsNewReleases.set([]);
      this.whatsNewErrorMessage.set(errorToMessage(error));
    } finally {
      this.whatsNewLoading.set(false);
    }
  }

  private async refreshWhatsNewUnreadCount(): Promise<void> {
    try {
      const count = await this.changelogService.fetchUnreadCount();
      this.whatsNewUnreadCount.set(count);
    } catch {
      this.whatsNewUnreadCount.set(0);
    }
  }

  private async markReleaseIdsAsRead(
    releaseIds: readonly string[],
  ): Promise<void> {
    if (releaseIds.length === 0) {
      await this.refreshWhatsNewUnreadCount();
      return;
    }

    try {
      await this.changelogService.markReleasesRead(releaseIds);
      this.whatsNewReleases.set([]);
    } finally {
      await this.refreshWhatsNewUnreadCount();
    }
  }

  private unreadWhatsNewReleaseIds(): readonly string[] {
    return this.whatsNewReleases()
      .filter((release) => !release.isRead)
      .map((release) => release.id);
  }

  private logUi(
    message: string,
    details?: unknown,
    level: "info" | "error" = "info",
  ): void {
    this.debugLog.logMessage("shell", message, details, level);
  }
}

function toMiniChatTone(
  rank: string,
): "neutral" | "accent" | "warm" | "danger" | "success" {
  if (rank === "admin") {
    return "danger";
  }

  if (rank === "mod") {
    return "accent";
  }

  if (rank === "veteran") {
    return "warm";
  }

  return "neutral";
}

const TOPBAR_GAMEPLAY_LOG_ACTION_ID = "topbar:gameplay-log";
const TOPBAR_ACHIEVEMENTS_ACTION_ID = "topbar:achievements";
const TOPBAR_GALLERY_ACTION_ID = "topbar:gallery";
const TOPBAR_SETTINGS_ACTION_ID = "topbar:settings";
const CHARACTER_PANEL_CHARACTER_SHEET_ACTION_ID = "character-sheet";

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
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as { error?: { message?: unknown } }).error?.message ===
      "string"
  ) {
    return (error as { error: { message: string } }).error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Import failed due to an unknown error.";
}

function resolveSaveSlotPortraitPath(
  player: Player,
  racesById: ReadonlyMap<string, Race>,
): string | undefined {
  const race = racesById.get(player.raceId);
  const appearance = player.selectedAppearance;

  if (!race || !appearance) {
    return undefined;
  }

  const portraitFile =
    race.variants?.[appearance.variant]?.[appearance.imageIndex];

  if (!portraitFile) {
    return undefined;
  }

  return `${race.imageBasePath}/${appearance.variant}/${portraitFile}`;
}

function buildInitialCharacterSnapshot(player: Player): {
  portraitShardId?: string;
  level?: number;
  locationId?: string;
  lastLocationName?: string;
} {
  const locationId = resolveLatestLocationId(player);

  return {
    portraitShardId: resolvePortraitShardId(player),
    level: Number.isInteger(player.progression.level) && player.progression.level > 0
      ? player.progression.level
      : undefined,
    locationId,
    lastLocationName: locationId ? humanizeLocationId(locationId) : undefined,
  };
}

function resolvePortraitShardId(player: Player): string | undefined {
  const appearance = player.selectedAppearance;

  if (!appearance) {
    return undefined;
  }

  return `${player.raceId}:${appearance.variant}:${appearance.imageIndex}`;
}

function resolveLatestLocationId(player: Player): string | undefined {
  const interactionState = player.interactionState;

  if (!interactionState) {
    return undefined;
  }

  const lastButtonLocationId = interactionState.lastButtonPress?.locationId?.trim();

  if (lastButtonLocationId) {
    return lastButtonLocationId;
  }

  const recent = interactionState.recentButtonPresses ?? [];

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const locationId = recent[index]?.locationId?.trim();

    if (locationId) {
      return locationId;
    }
  }

  return undefined;
}

function humanizeLocationId(locationId: string): string {
  return locationId
    .split(/[-_]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}

function shouldShowServerSelectOnStartup(): boolean {
  try {
    const persisted = localStorage.getItem(SERVER_SELECT_STARTUP_KEY);
    return persisted !== "hidden";
  } catch {
    return true;
  }
}

function persistServerSelectPreference(open: boolean): void {
  try {
    localStorage.setItem(
      SERVER_SELECT_STARTUP_KEY,
      open ? "visible" : "hidden",
    );
  } catch {
    // Ignore persistence failures.
  }
}

const SERVER_SELECT_STARTUP_KEY = "grayvale:server-select:start-up";

function resolveModerationTarget(
  players: readonly ServerPresencePlayerView[],
  rawTarget: string,
): ServerPresencePlayerView | null {
  const normalizedTarget = normalizeModerationTarget(rawTarget);

  if (!normalizedTarget) {
    return null;
  }

  const exactDisplayNameMatches = players.filter(
    (player) => normalizeModerationTarget(player.displayName) === normalizedTarget,
  );

  if (exactDisplayNameMatches.length === 1) {
    return exactDisplayNameMatches[0] ?? null;
  }

  const exactUuidMatch =
    players.find(
      (player) =>
        normalizeModerationTarget(player.characterId ?? player.profileId) === normalizedTarget ||
        normalizeModerationTarget(player.profileId) === normalizedTarget,
    ) ?? null;

  if (exactUuidMatch) {
    return exactUuidMatch;
  }

  const partialMatches = players.filter((player) => {
    const displayName = normalizeModerationTarget(player.displayName);
    return displayName.includes(normalizedTarget);
  });

  return partialMatches.length === 1 ? (partialMatches[0] ?? null) : null;
}

function normalizeModerationTarget(value: string | undefined): string {
  return (value ?? "").trim().replace(/^@/u, "").toLowerCase();
}
