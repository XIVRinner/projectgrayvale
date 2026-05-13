import { DOCUMENT } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom, fromEvent, timer } from "rxjs";

import { ChatEmotesLoader } from "../../data/loaders/chat-emotes.loader";
import { AdminSocialService } from "./admin-social.service";
import { ChatApiService } from "./chat-api.service";
import { DirectMessageService } from "./direct-message.service";
import { GuildService } from "./guild.service";
import { SERVER_CHAT_COMMANDS } from "./server-chat-commands";
import { ServerConnectionService } from "./server-connection.service";
import { SocialService } from "./social.service";
import {
  AdminPlayerListEntryView,
  AdminProfileDetailView,
  CurrentGuildView,
  GuildInvitationView,
  SocialFriendshipView,
  ServerChatChannelView,
  ServerChatCommandView,
  ServerChatCustomEmojiView,
  ServerChatMessageView,
  ServerDirectConversationView,
  ServerModerationRequest,
  ServerChatPanelView,
  ServerFooterSummaryView,
  ServerInfoView,
  ServerPresencePlayerView,
  ServerPresenceResponse,
  SocialIdentityView,
} from "./server-chat.models";

const CHAT_LIMIT = 60;
const PLAYER_LIMIT = 24;
const PRESENCE_POLL_MS = 15_000;
const CHAT_POLL_MS = 4_000;

interface ServerChatMessageApiView {
  readonly id: string;
  readonly channelId: string;
  readonly channelType: ServerChatChannelView["type"];
  readonly senderProfileId?: string;
  readonly senderCharacterId?: string;
  readonly senderCharacterName?: string;
  readonly body: string;
  readonly createdAt: string;
  readonly messageType: "user" | "system" | "motd" | "moderation";
  readonly sender: SocialIdentityView;
}

interface ServerChatHistoryApiResponse {
  readonly count: number;
  readonly entries: readonly ServerChatMessageApiView[];
}

@Injectable({ providedIn: "root" })
export class ServerChatService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly chatEmotesLoader = inject(ChatEmotesLoader);
  private readonly serverConnection = inject(ServerConnectionService);
  private readonly chatApi = inject(ChatApiService);
  private readonly directMessageService = inject(DirectMessageService);
  private readonly adminSocialService = inject(AdminSocialService);
  private readonly socialService = inject(SocialService);
  private readonly guildService = inject(GuildService);

  private readonly panelOpenState = signal(false);
  private readonly infoState = signal<ServerInfoView | null>(null);
  private readonly customEmojisState = signal<readonly ServerChatCustomEmojiView[]>(
    [],
  );
  private readonly playersState = signal<readonly ServerPresencePlayerView[]>(
    [],
  );
  private readonly channelsState = signal<readonly ServerChatChannelView[]>([]);
  private readonly activeChannelIdState = signal<string | null>(null);
  private readonly messagesByChannelState = signal<
    Record<string, readonly ServerChatMessageView[]>
  >({});
  private readonly directConversationsState = signal<readonly ServerDirectConversationView[]>(
    [],
  );
  private readonly lastSeenMessageIdState = signal<Record<string, string>>({});
  private readonly statusMessageState = signal<string | null>(null);
  private readonly sendingState = signal(false);
  private readonly documentVisibleState = signal(!this.document.hidden);
  private readonly adminEntriesState = signal<readonly AdminPlayerListEntryView[]>([]);
  private readonly adminTotalState = signal(0);
  private readonly adminPageState = signal(1);
  private readonly adminPageSizeState = signal(20);
  private readonly adminSearchState = signal("");
  private readonly adminLoadingState = signal(false);
  private readonly selectedAdminProfileIdState = signal<string | null>(null);
  private readonly adminProfileDetailState = signal<AdminProfileDetailView | null>(null);
  private readonly grantablePermissionsState = signal<readonly string[]>([]);
  private readonly adminPanelAccessState = signal(false);
  private readonly socialPlayersState = signal<readonly AdminPlayerListEntryView[]>([]);
  private readonly socialPlayersTotalState = signal(0);
  private readonly socialPlayersPageState = signal(1);
  private readonly socialPlayersPageSizeState = signal(20);
  private readonly socialPlayersSearchState = signal("");
  private readonly socialPlayersLoadingState = signal(false);
  private readonly friendshipsState = signal<readonly SocialFriendshipView[]>([]);
  private readonly friendsLoadingState = signal(false);
  private readonly currentGuildState = signal<CurrentGuildView | null>(null);
  private readonly guildInvitationsState = signal<readonly GuildInvitationView[]>([]);
  private readonly guildLoadingState = signal(false);

  private presenceRefreshInFlight = false;
  private channelsRefreshInFlight = false;
  private messagesRefreshInFlight = false;

  readonly panelOpen = this.panelOpenState.asReadonly();
  readonly info = this.infoState.asReadonly();
  readonly customEmojis = this.customEmojisState.asReadonly();
  readonly players = this.playersState.asReadonly();
  readonly channels = this.channelsState.asReadonly();
  readonly activeChannelId = this.activeChannelIdState.asReadonly();
  readonly messages = computed<readonly ServerChatMessageView[]>(() =>
    selectActiveChannelMessages(
      this.messagesByChannelState(),
      this.activeChannelIdState(),
    ),
  );
  readonly directConversations = this.directConversationsState.asReadonly();
  readonly statusMessage = this.statusMessageState.asReadonly();
  readonly isSending = this.sendingState.asReadonly();
  readonly commands = computed<readonly ServerChatCommandView[]>(
    () => SERVER_CHAT_COMMANDS,
  );
  readonly canSend = computed(() => {
    const session = this.serverConnection.session();
    return session !== null && session.chatAccess === "allowed";
  });
  readonly canModerate = this.serverConnection.canModerate;
  readonly canShowAdminPanel = computed(() => {
    const session = this.serverConnection.session();
    return session !== null && (session.rank === "admin" || this.adminPanelAccessState());
  });
  readonly canBlockServerEntry = this.serverConnection.canBlockServerEntry;
  readonly sendHint = computed(() => {
    const session = this.serverConnection.session();

    if (!session) {
      return "Connect this character before sending messages.";
    }

    if (session.chatAccess === "banned") {
      return session.chatReason
        ? `Chat access revoked: ${session.chatReason}`
        : "Chat access has been revoked on this shard.";
    }

    if (session.chatAccess === "timed_out") {
      const untilLabel = session.chatTimeoutUntil
        ? new Date(session.chatTimeoutUntil).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "later";

      return session.chatReason
        ? `Timed out until ${untilLabel}: ${session.chatReason}`
        : `Timed out until ${untilLabel}.`;
    }

    return "Enter sends. Shift+Enter makes a new line. Slash commands work in all tabs.";
  });
  readonly currentPlayerUuid = computed(
    () => this.serverConnection.session()?.playerUuid ?? null,
  );
  readonly footerSummary = computed<ServerFooterSummaryView>(() => {
    const server = this.serverConnection.selectedServer();
    const session = this.serverConnection.session();
    const onlinePlayerCount = this.playersState().length;
    const connectionLabel = session
      ? `Connected as ${session.rank.toUpperCase()}`
      : "Read-only";

    return {
      label: this.infoState()?.name ?? server.label,
      detail: `${onlinePlayerCount} online - ${connectionLabel}`,
      onlinePlayerCount,
      isConnected: session !== null,
    };
  });
  readonly panel = computed<ServerChatPanelView>(() => {
    const server = this.serverConnection.selectedServer();
    const session = this.serverConnection.session();
    const serverInfo = this.infoState();

    return {
      title: serverInfo?.name ?? server.label,
      subtitle: server.clientId,
      endpointLabel: `${server.protocol}://${server.host}:${server.port}`,
      onlinePlayerCount: this.playersState().length,
      isConnected: session !== null,
      sessionRankLabel: session?.rank.toUpperCase() ?? null,
      sessionChatAccessLabel: session?.chatAccessLabel ?? null,
      channels: this.channelsState(),
      activeChannelId: this.activeChannelIdState(),
    };
  });
  readonly adminEntries = this.adminEntriesState.asReadonly();
  readonly adminTotal = this.adminTotalState.asReadonly();
  readonly adminPage = this.adminPageState.asReadonly();
  readonly adminPageSize = this.adminPageSizeState.asReadonly();
  readonly adminSearch = this.adminSearchState.asReadonly();
  readonly adminLoading = this.adminLoadingState.asReadonly();
  readonly selectedAdminProfileId = this.selectedAdminProfileIdState.asReadonly();
  readonly adminProfileDetail = this.adminProfileDetailState.asReadonly();
  readonly grantablePermissions = this.grantablePermissionsState.asReadonly();
  readonly socialPlayers = this.socialPlayersState.asReadonly();
  readonly socialPlayersTotal = this.socialPlayersTotalState.asReadonly();
  readonly socialPlayersPage = this.socialPlayersPageState.asReadonly();
  readonly socialPlayersPageSize = this.socialPlayersPageSizeState.asReadonly();
  readonly socialPlayersSearch = this.socialPlayersSearchState.asReadonly();
  readonly socialPlayersLoading = this.socialPlayersLoadingState.asReadonly();
  readonly friendships = this.friendshipsState.asReadonly();
  readonly friendsLoading = this.friendsLoadingState.asReadonly();
  readonly currentGuild = this.currentGuildState.asReadonly();
  readonly guildInvitations = this.guildInvitationsState.asReadonly();
  readonly guildLoading = this.guildLoadingState.asReadonly();

  constructor() {
    this.chatEmotesLoader
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (customEmojis) => this.customEmojisState.set(customEmojis),
        error: () => this.customEmojisState.set([]),
      });

    effect(
      () => {
        this.serverConnection.selectedServer();
        this.serverConnection.session();
        this.infoState.set(null);
        this.playersState.set([]);
        this.channelsState.set([]);
        this.activeChannelIdState.set(null);
        this.messagesByChannelState.set({});
        this.directConversationsState.set([]);
        this.lastSeenMessageIdState.set({});
        this.statusMessageState.set(null);
        this.adminEntriesState.set([]);
        this.adminTotalState.set(0);
        this.adminPageState.set(1);
        this.adminSearchState.set("");
        this.adminLoadingState.set(false);
        this.selectedAdminProfileIdState.set(null);
        this.adminProfileDetailState.set(null);
        this.grantablePermissionsState.set([]);
        this.adminPanelAccessState.set(false);
        this.socialPlayersState.set([]);
        this.socialPlayersTotalState.set(0);
        this.socialPlayersPageState.set(1);
        this.socialPlayersSearchState.set("");
        this.socialPlayersLoadingState.set(false);
        this.friendshipsState.set([]);
        this.friendsLoadingState.set(false);
        this.currentGuildState.set(null);
        this.guildInvitationsState.set([]);
        this.guildLoadingState.set(false);
        queueMicrotask(() => void this.refreshAll());
      },
      { allowSignalWrites: true },
    );

    fromEvent(this.document, "visibilitychange")
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.documentVisibleState.set(!this.document.hidden);

        if (!this.document.hidden) {
          void this.refreshAll();
        }
      });

    timer(0, PRESENCE_POLL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.shouldPollPresence()) {
          return;
        }

        void this.refreshPresence();
      });

    timer(0, CHAT_POLL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.shouldPollMessages()) {
          return;
        }

        void this.refreshChannelsAndMessages();
      });
  }

  openPanel(): void {
    this.panelOpenState.set(true);
    this.statusMessageState.set(null);
    void this.refreshAll();
  }

  closePanel(): void {
    this.panelOpenState.set(false);
  }

  openServerSelectHint(): void {
    this.statusMessageState.set(
      "Open Server Select to connect this character and enable chat.",
    );
  }

  showStatusMessage(message: string | null): void {
    this.statusMessageState.set(message);
  }

  selectChannel(channelId: string): void {
    if (!this.channelsState().some((channel) => channel.id === channelId)) {
      return;
    }

    this.activeChannelIdState.set(channelId);
    void this.refreshMessages();
  }

  async sendMessage(message: string): Promise<void> {
    const trimmedMessage = message.trim();
    const session = this.serverConnection.session();
    const activeChannelId = this.activeChannelIdState();
    const activeChannel = this.channelsState().find(
      (channel) => channel.id === activeChannelId,
    );

    if (!trimmedMessage) {
      return;
    }

    if (!session) {
      this.openServerSelectHint();
      return;
    }

    if (!activeChannelId) {
      this.statusMessageState.set("Select a channel first.");
      return;
    }

    if (!activeChannel) {
      this.statusMessageState.set("Select a valid channel first.");
      return;
    }

    if (activeChannel.type === "system") {
      this.statusMessageState.set("System channel is read-only.");
      return;
    }

    this.sendingState.set(true);

    try {
      if (activeChannel.type === "direct") {
        await this.directMessageService.sendConversationMessage(
          activeChannelId,
          trimmedMessage,
        );
      } else {
        await this.chatApi.sendChannelMessage(activeChannelId, trimmedMessage);
      }
      this.statusMessageState.set(null);
      await this.refreshChannelsAndMessages();
    } catch (error) {
      this.statusMessageState.set(toErrorMessage(error));
    } finally {
      this.sendingState.set(false);
    }
  }

  async openDirectConversation(targetProfileId: string): Promise<string> {
    const conversationId =
      await this.directMessageService.openConversation(targetProfileId);
    await this.refreshChannels();
    this.activeChannelIdState.set(conversationId);
    await this.refreshMessages();
    return conversationId;
  }

  async sendWhisper(
    targetCharacterName: string,
    body: string,
  ): Promise<string> {
    const result = await this.directMessageService.sendWhisper(
      targetCharacterName,
      body,
    );
    await this.refreshChannels();
    this.activeChannelIdState.set(result.conversationId);
    await this.refreshMessages();
    return result.conversationId;
  }

  async moderatePlayer(request: ServerModerationRequest): Promise<void> {
    const session = this.serverConnection.session();

    if (!session) {
      this.openServerSelectHint();
      return;
    }

    await firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/server/admin/moderation"),
        {
          ...request,
          sessionId: session.sessionId,
        },
        {
          withCredentials: true,
        },
      ),
    );

    await Promise.all([
      this.serverConnection.restoreSessionFromCookie().catch(() => null),
      this.refreshPresence(),
      this.refreshMessages(),
    ]);
  }

  async refreshAll(): Promise<void> {
    await Promise.allSettled([
      this.refreshInfo(),
      this.refreshPresence(),
      this.refreshChannelsAndMessages(),
      this.refreshAdminPanel(),
      this.refreshSocialPanels(),
    ]);
  }

  async refreshPresence(): Promise<void> {
    if (this.presenceRefreshInFlight) {
      return;
    }

    this.presenceRefreshInFlight = true;

    try {
      const response = await firstValueFrom(
        this.http.get<ServerPresenceResponse>(
          this.serverConnection.serverApiUrl("/api/server/presence"),
          {
            params: this.presenceParams(),
            withCredentials: true,
          },
        ),
      );

      this.infoState.set(response.server);
      this.playersState.set(response.players);
      this.messagesByChannelState.update((messagesByChannel) =>
        hydrateChannelMessageAvatars(messagesByChannel, response.players),
      );
      const currentPlayer = response.players.find(
        (player) => player.playerUuid === this.currentPlayerUuid(),
      );

      if (currentPlayer) {
        this.serverConnection.syncSessionModeration(currentPlayer.playerUuid, {
          chatAccess: currentPlayer.chatAccess,
          chatAccessLabel: currentPlayer.chatAccessLabel,
          chatTimeoutUntil: currentPlayer.chatTimeoutUntil,
          chatReason: currentPlayer.chatReason,
        });
      }
    } catch (error) {
      this.playersState.set([]);

      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.presenceRefreshInFlight = false;
    }
  }

  async refreshChannelsAndMessages(): Promise<void> {
    await this.refreshChannels();
    await this.refreshMessages();
  }

  async refreshChannels(): Promise<void> {
    if (this.channelsRefreshInFlight) {
      return;
    }

    this.channelsRefreshInFlight = true;

    try {
      let directFetchFailed = false;
      const [channelsResponse, directResponse] = await Promise.all([
        this.chatApi.loadChannels().then((channels) => ({ channels })),
        this.directMessageService.loadDirectConversations().then((conversations) => ({ conversations })).catch((error) => {
          directFetchFailed = true;
          if (this.panelOpenState()) {
            this.statusMessageState.set(toErrorMessage(error));
          }
          return { conversations: [] as readonly ServerDirectConversationView[] };
        }),
      ]);

      const directIds = new Set(directResponse.conversations.map((row) => row.id));
      const normalizedChannels = channelsResponse.channels.filter(
        (channel) => channel.type !== "direct" || directIds.has(channel.id),
      );
      this.directConversationsState.set(directResponse.conversations);
      this.channelsState.set(normalizedChannels);
      if (directFetchFailed && this.panelOpenState()) {
        this.statusMessageState.set("Direct conversations are temporarily unavailable. Try again shortly.");
      }

      if (
        !this.activeChannelIdState() ||
        !normalizedChannels.some((channel) => channel.id === this.activeChannelIdState())
      ) {
        const preferred =
          normalizedChannels.find((channel) => channel.name.toLowerCase() === "world") ??
          normalizedChannels[0];
        this.activeChannelIdState.set(preferred?.id ?? null);
      }
    } catch (error) {
      this.channelsState.set([]);
      this.directConversationsState.set([]);

      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.channelsRefreshInFlight = false;
    }
  }

  async refreshMessages(): Promise<void> {
    if (this.messagesRefreshInFlight) {
      return;
    }

    const activeChannel = this.channelsState().find(
      (channel) => channel.id === this.activeChannelIdState(),
    );

    if (!activeChannel) {
      return;
    }

    this.messagesRefreshInFlight = true;

    try {
      const after = this.lastSeenMessageIdState()[activeChannel.id];
      const response = await this.fetchChannelEntries(activeChannel, after);

      const incoming = response.entries.map((entry) =>
        mapServerChatMessage(entry, this.playersState()),
      );
      const existingMessages =
        this.messagesByChannelState()[activeChannel.id] ?? [];
      let merged = dedupeById([...existingMessages, ...incoming]).slice(-CHAT_LIMIT);

      if (activeChannel.type === "system") {
        try {
          const motd = await this.chatApi.loadMotd();
          const motdEntry: ServerChatMessageView = {
            id: "motd",
            channelId: activeChannel.id,
            channelType: "system",
            messageType: "motd",
            playerUuid: "system",
            rank: "admin",
            chatAccess: "allowed",
            chatAccessLabel: "System",
            serverBanned: false,
            message: motd,
            createdAt: new Date().toISOString(),
            sender: {
              profileId: "system",
              profileDisplayName: "System",
              characterName: "System",
              online: true,
              badges: [{ type: "permission", label: "System" }],
            },
          };
          merged = dedupeById([...merged, motdEntry]).slice(-CHAT_LIMIT);
        } catch {
          // ignore motd fetch issues; regular messages remain available
        }
      }

      this.messagesByChannelState.update((messagesByChannel) => ({
        ...messagesByChannel,
        [activeChannel.id]: merged,
      }));
      const last = merged.at(-1);

      if (last) {
        this.lastSeenMessageIdState.update((value) => ({
          ...value,
          [activeChannel.id]: last.id,
        }));
      }
    } catch (error) {
      this.messagesByChannelState.update((messagesByChannel) => ({
        ...messagesByChannel,
        [activeChannel.id]: [],
      }));

      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.messagesRefreshInFlight = false;
    }
  }

  async refreshAdminPanel(): Promise<void> {
    const session = this.serverConnection.session();

    if (!session) {
      return;
    }

    if (session.rank !== "admin" && !this.adminPanelAccessState()) {
      try {
        const permissions = await this.adminSocialService.listGrantablePermissions();
        this.grantablePermissionsState.set(permissions);
        this.adminPanelAccessState.set(true);
      } catch {
        this.adminPanelAccessState.set(false);
        return;
      }
    }

    if (!this.canShowAdminPanel()) {
      return;
    }

    this.adminLoadingState.set(true);

    try {
      const [players, permissions] = await Promise.all([
        this.adminSocialService.loadPlayers({
          page: this.adminPageState(),
          pageSize: this.adminPageSizeState(),
          search: this.adminSearchState(),
        }),
        this.adminSocialService.listGrantablePermissions(),
      ]);
      this.adminEntriesState.set(players.entries);
      this.adminTotalState.set(players.total);
      this.grantablePermissionsState.set(permissions);

      const selectedProfileId = this.selectedAdminProfileIdState() ?? players.entries[0]?.profileId;

      if (selectedProfileId) {
        this.selectedAdminProfileIdState.set(selectedProfileId);
        this.adminProfileDetailState.set(
          await this.adminSocialService.loadProfileDetail(selectedProfileId),
        );
      } else {
        this.selectedAdminProfileIdState.set(null);
        this.adminProfileDetailState.set(null);
      }
    } catch (error) {
      this.adminEntriesState.set([]);
      this.adminTotalState.set(0);
      this.adminProfileDetailState.set(null);
      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.adminLoadingState.set(false);
    }
  }

  setAdminSearch(search: string): void {
    this.adminSearchState.set(search.trim());
    this.adminPageState.set(1);
    void this.refreshAdminPanel();
  }

  setAdminPage(page: number): void {
    this.adminPageState.set(Math.max(1, page));
    void this.refreshAdminPanel();
  }

  selectAdminProfile(profileId: string): void {
    this.selectedAdminProfileIdState.set(profileId);
    void this.refreshAdminPanel();
  }

  async grantProfilePermission(profileId: string, permissionId: string): Promise<void> {
    await this.adminSocialService.grantPermission(profileId, permissionId);
    await this.refreshAdminPanel();
  }

  async revokeProfilePermission(profileId: string, permissionId: string): Promise<void> {
    await this.adminSocialService.revokePermission(profileId, permissionId);
    await this.refreshAdminPanel();
  }

  async moderateProfile(
    profileId: string,
    action: "kick" | "ban" | "unban" | "mute" | "unmute" | "warn",
  ): Promise<void> {
    await this.adminSocialService.moderateProfile(profileId, action, {});
    await this.refreshAdminPanel();
  }

  async addAdminNote(profileId: string, body: string): Promise<void> {
    if (!body.trim()) {
      return;
    }

    await this.adminSocialService.addNote(profileId, body);
    await this.refreshAdminPanel();
  }

  async refreshSocialPanels(): Promise<void> {
    await Promise.allSettled([
      this.refreshPlayerDirectory(),
      this.refreshFriendships(),
      this.refreshGuildPanel(),
    ]);
  }

  async refreshPlayerDirectory(): Promise<void> {
    this.socialPlayersLoadingState.set(true);
    try {
      const response = await this.socialService.loadPlayers({
        page: this.socialPlayersPageState(),
        pageSize: this.socialPlayersPageSizeState(),
        search: this.socialPlayersSearchState(),
      });
      this.socialPlayersState.set(response.entries);
      this.socialPlayersTotalState.set(response.total);
    } catch (error) {
      this.socialPlayersState.set([]);
      this.socialPlayersTotalState.set(0);
      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.socialPlayersLoadingState.set(false);
    }
  }

  setSocialPlayersSearch(search: string): void {
    this.socialPlayersSearchState.set(search.trim());
    this.socialPlayersPageState.set(1);
    void this.refreshPlayerDirectory();
  }

  setSocialPlayersPage(page: number): void {
    this.socialPlayersPageState.set(Math.max(1, page));
    void this.refreshPlayerDirectory();
  }

  async refreshFriendships(): Promise<void> {
    this.friendsLoadingState.set(true);
    try {
      const response = await this.socialService.listFriends();
      this.friendshipsState.set(response.friendships);
    } catch (error) {
      this.friendshipsState.set([]);
      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.friendsLoadingState.set(false);
    }
  }

  async addCharacterFriend(targetProfileId: string, targetCharacterId?: string): Promise<void> {
    await this.socialService.addCharacterFriend(targetProfileId, targetCharacterId);
    await this.refreshFriendships();
  }

  async requestProfileFriend(targetProfileId: string): Promise<void> {
    await this.socialService.requestProfileFriend(targetProfileId);
    await this.refreshFriendships();
  }

  async acceptFriendRequest(friendshipId: string): Promise<void> {
    await this.socialService.acceptFriendRequest(friendshipId);
    await this.refreshFriendships();
  }

  async rejectFriendRequest(friendshipId: string): Promise<void> {
    await this.socialService.rejectFriendRequest(friendshipId);
    await this.refreshFriendships();
  }

  async removeFriendship(friendshipId: string): Promise<void> {
    await this.socialService.removeFriendship(friendshipId);
    await this.refreshFriendships();
  }

  async refreshGuildPanel(): Promise<void> {
    this.guildLoadingState.set(true);
    try {
      const [currentGuildResponse, invitationsResponse] = await Promise.all([
        this.guildService.loadCurrentGuild(),
        this.guildService.loadInvitations(),
      ]);
      this.currentGuildState.set(currentGuildResponse.guild);
      this.guildInvitationsState.set(invitationsResponse.invitations);
    } catch (error) {
      this.currentGuildState.set(null);
      this.guildInvitationsState.set([]);
      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.guildLoadingState.set(false);
    }
  }

  async createGuild(input: { name: string; shortName: string }): Promise<void> {
    await this.guildService.createGuild(input);
    await this.refreshGuildPanel();
    await this.refreshChannels();
  }

  async inviteToGuild(guildId: string, targetProfileId: string, targetCharacterId?: string): Promise<void> {
    await this.guildService.inviteToGuild(guildId, {
      targetProfileId,
      targetCharacterId,
    });
    await this.refreshGuildPanel();
  }

  async respondGuildInvitation(invitationId: string, accept: boolean): Promise<void> {
    await this.guildService.respondToInvitation(invitationId, accept);
    await this.refreshGuildPanel();
    await this.refreshChannels();
  }

  async setGuildMemberRole(
    guildId: string,
    characterId: string,
    role: "guild_master" | "officer" | "member" | "recruit",
  ): Promise<void> {
    await this.guildService.setMemberRole(guildId, characterId, role);
    await this.refreshGuildPanel();
  }

  async leaveGuild(guildId: string): Promise<void> {
    await this.guildService.leaveGuild(guildId);
    await this.refreshGuildPanel();
    await this.refreshChannels();
  }

  async leaveCustomChannel(channelId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/chat/channels/${channelId}/leave`),
        {},
        { withCredentials: true },
      ),
    );
    await this.refreshChannels();
    const activeChannelId = this.activeChannelIdState();
    if (activeChannelId === channelId) {
      const channels = this.channelsState();
      const nextChannel = channels.find((c) => c.id !== channelId);
      this.activeChannelIdState.set(nextChannel?.id ?? null);
    }
  }

  async destroyCustomChannel(channelId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/chat/channels/${channelId}/destroy`),
        {},
        { withCredentials: true },
      ),
    );
    await this.refreshChannels();
    const activeChannelId = this.activeChannelIdState();
    if (activeChannelId === channelId) {
      const channels = this.channelsState();
      const nextChannel = channels.find((c) => c.id !== channelId);
      this.activeChannelIdState.set(nextChannel?.id ?? null);
    }
  }

  async closeDirectConversation(conversationId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/chat/direct/${conversationId}/close`),
        {},
        { withCredentials: true },
      ),
    );
    await this.refreshChannels();
    const activeChannelId = this.activeChannelIdState();
    if (activeChannelId === conversationId) {
      const channels = this.channelsState();
      const nextChannel = channels.find((c) => c.id !== conversationId);
      this.activeChannelIdState.set(nextChannel?.id ?? null);
    }
  }

  private shouldPollPresence(): boolean {
    return this.documentVisibleState() && (this.panelOpenState() || this.serverConnection.isConnected());
  }

  private shouldPollMessages(): boolean {
    return this.documentVisibleState() && this.panelOpenState();
  }

  private async refreshInfo(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ServerInfoView>(
          this.serverConnection.serverApiUrl("/api/server/info"),
          {
            withCredentials: true,
          },
        ),
      );

      this.infoState.set(response);
    } catch {
      this.infoState.set(null);
    }
  }

  private presenceParams(): Record<string, string> {
    return { limit: String(PLAYER_LIMIT) };
  }

  private async fetchChannelEntries(
    channel: ServerChatChannelView,
    after?: string,
  ): Promise<ServerChatHistoryApiResponse> {
    const entries = channel.type === "direct"
      ? await this.directMessageService.pollDirectMessages(channel.id, after, CHAT_LIMIT)
      : await this.chatApi.pollChannelMessages(channel.id, after, CHAT_LIMIT);

    return {
      count: entries.length,
      entries,
    };
  }
}

export function mapServerChatMessage(
  entry: ServerChatMessageApiView,
  players: readonly ServerPresencePlayerView[],
): ServerChatMessageView {
  const avatarPath = resolveMessageAvatarPath(entry, players);

  return {
    id: entry.id,
    channelId: entry.channelId,
    channelType: entry.channelType,
    messageType: entry.messageType,
    playerUuid: entry.senderCharacterId ?? entry.senderProfileId ?? "system",
    displayName:
      entry.sender.characterName ??
      entry.sender.profileDisplayName ??
      entry.senderCharacterName ??
      entry.sender.characterId ??
      entry.sender.profileId ??
      entry.senderCharacterId ??
      entry.senderProfileId ??
      "Unnamed",
    avatarPath,
    rank: mapRank(entry.sender.badges),
    chatAccess: "allowed",
    chatAccessLabel: "Chat Open",
    serverBanned: false,
    message: entry.body,
    createdAt: entry.createdAt,
    sender: entry.sender,
  };
}

export function hydrateMessageAvatars(
  messages: readonly ServerChatMessageView[],
  players: readonly ServerPresencePlayerView[],
): readonly ServerChatMessageView[] {
  return messages.map((message) => {
    if (message.avatarPath || message.messageType !== "user") {
      return message;
    }

    const avatarPath = players.find(
      (player) => player.playerUuid === message.playerUuid,
    )?.avatarPath;

    return avatarPath ? { ...message, avatarPath } : message;
  });
}

export function hydrateChannelMessageAvatars(
  messagesByChannel: Record<string, readonly ServerChatMessageView[]>,
  players: readonly ServerPresencePlayerView[],
): Record<string, readonly ServerChatMessageView[]> {
  return Object.fromEntries(
    Object.entries(messagesByChannel).map(([channelId, messages]) => [
      channelId,
      hydrateMessageAvatars(messages, players),
    ]),
  );
}

export function selectActiveChannelMessages(
  messagesByChannel: Record<string, readonly ServerChatMessageView[]>,
  activeChannelId: string | null,
): readonly ServerChatMessageView[] {
  if (!activeChannelId) {
    return [];
  }

  return messagesByChannel[activeChannelId] ?? [];
}

function resolveMessageAvatarPath(
  entry: ServerChatMessageApiView,
  players: readonly ServerPresencePlayerView[],
): string | undefined {
  const playerUuid = entry.senderCharacterId ?? entry.senderProfileId;

  if (!playerUuid || entry.messageType !== "user") {
    return undefined;
  }

  return players.find((player) => player.playerUuid === playerUuid)?.avatarPath;
}

function mapRank(badges: readonly { label: string }[]): "player" | "vip" | "moderator" | "admin" {
  const labels = new Set(badges.map((badge) => badge.label.toLowerCase()));

  if (labels.has("admin")) {
    return "admin";
  }

  if (labels.has("moderator")) {
    return "moderator";
  }

  if (labels.has("vip")) {
    return "vip";
  }

  return "player";
}

function dedupeById(entries: readonly ServerChatMessageView[]): ServerChatMessageView[] {
  const seen = new Set<string>();
  const deduped: ServerChatMessageView[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    deduped.push(entry);
  }

  return deduped;
}

function toErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "The server relay is unavailable right now.";
  }

  const serverMessage = (error as { error?: { message?: unknown } }).error
    ?.message;

  if (typeof serverMessage === "string" && serverMessage.trim().length > 0) {
    return serverMessage;
  }

  return "The server relay is unavailable right now.";
}
