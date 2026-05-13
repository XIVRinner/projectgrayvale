import { DOCUMENT } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom, fromEvent, timer } from "rxjs";

import { ChatEmotesLoader } from "../../data/loaders/chat-emotes.loader";
import { AdminSocialService } from "./admin-social.service";
import { ChatApiService } from "./chat-api.service";
import { DirectMessageService } from "./direct-message.service";
import { SERVER_CHAT_COMMANDS } from "./server-chat-commands";
import { ServerConnectionService } from "./server-connection.service";
import {
  AdminPlayerListEntryView,
  AdminProfileDetailView,
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
  private readonly messagesState = signal<readonly ServerChatMessageView[]>([]);
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

  private presenceRefreshInFlight = false;
  private channelsRefreshInFlight = false;
  private messagesRefreshInFlight = false;

  readonly panelOpen = this.panelOpenState.asReadonly();
  readonly info = this.infoState.asReadonly();
  readonly customEmojis = this.customEmojisState.asReadonly();
  readonly players = this.playersState.asReadonly();
  readonly channels = this.channelsState.asReadonly();
  readonly activeChannelId = this.activeChannelIdState.asReadonly();
  readonly messages = this.messagesState.asReadonly();
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
        this.messagesState.set([]);
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

    this.sendingState.set(true);

    try {
      await this.chatApi.sendChannelMessage(activeChannelId, trimmedMessage);
      this.statusMessageState.set(null);
      await this.refreshChannelsAndMessages();
    } catch (error) {
      this.statusMessageState.set(toErrorMessage(error));
    } finally {
      this.sendingState.set(false);
    }
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
      this.messagesState.set([]);
      return;
    }

    this.messagesRefreshInFlight = true;

    try {
      const after = this.lastSeenMessageIdState()[activeChannel.id];
      const response = await this.fetchChannelEntries(activeChannel, after);

      const incoming = response.entries.map((entry) => mapMessage(entry));
      let merged = dedupeById([...this.messagesState(), ...incoming]).slice(-CHAT_LIMIT);

      if (activeChannel.type === "system") {
        try {
          const motd = await this.chatApi.loadMotd();
          const motdEntry: ServerChatMessageView = {
            id: "motd",
            channelId: activeChannel.id,
            channelType: "system",
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

      this.messagesState.set(merged);
      const last = merged.at(-1);

      if (last) {
        this.lastSeenMessageIdState.update((value) => ({
          ...value,
          [activeChannel.id]: last.id,
        }));
      }
    } catch (error) {
      this.messagesState.set([]);

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

function mapMessage(entry: ServerChatMessageApiView): ServerChatMessageView {
  return {
    id: entry.id,
    channelId: entry.channelId,
    channelType: entry.channelType,
    playerUuid: entry.senderCharacterId ?? entry.senderProfileId ?? "system",
    displayName:
      entry.sender.characterName ??
      entry.sender.profileDisplayName ??
      entry.senderCharacterName ??
      "Unknown Adventurer",
    avatarPath: undefined,
    rank: mapRank(entry.sender.badges),
    chatAccess: "allowed",
    chatAccessLabel: "Chat Open",
    serverBanned: false,
    message: entry.body,
    createdAt: entry.createdAt,
    sender: entry.sender,
  };
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
