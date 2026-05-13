import { DOCUMENT } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom, fromEvent, timer } from "rxjs";

import { ChatEmotesLoader } from "../../data/loaders/chat-emotes.loader";
import { SERVER_CHAT_COMMANDS } from "./server-chat-commands";
import { ServerConnectionService } from "./server-connection.service";
import {
  ServerChatCommandView,
  ServerChatCustomEmojiView,
  ServerChatHistoryResponse,
  ServerChatMessageView,
  ServerModerationRequest,
  ServerChatPanelView,
  ServerFooterSummaryView,
  ServerInfoView,
  ServerPresencePlayerView,
  ServerPresenceResponse,
} from "./server-chat.models";

const CHAT_LIMIT = 60;
const PLAYER_LIMIT = 24;
const PRESENCE_POLL_MS = 15_000;
const CHAT_POLL_MS = 4_000;

@Injectable({ providedIn: "root" })
export class ServerChatService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly chatEmotesLoader = inject(ChatEmotesLoader);
  private readonly serverConnection = inject(ServerConnectionService);

  private readonly panelOpenState = signal(false);
  private readonly infoState = signal<ServerInfoView | null>(null);
  private readonly customEmojisState = signal<readonly ServerChatCustomEmojiView[]>(
    [],
  );
  private readonly playersState = signal<readonly ServerPresencePlayerView[]>(
    [],
  );
  private readonly messagesState = signal<readonly ServerChatMessageView[]>([]);
  private readonly statusMessageState = signal<string | null>(null);
  private readonly sendingState = signal(false);
  private readonly documentVisibleState = signal(!this.document.hidden);

  private presenceRefreshInFlight = false;
  private messagesRefreshInFlight = false;

  readonly panelOpen = this.panelOpenState.asReadonly();
  readonly info = this.infoState.asReadonly();
  readonly customEmojis = this.customEmojisState.asReadonly();
  readonly players = this.playersState.asReadonly();
  readonly messages = this.messagesState.asReadonly();
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

    return "Enter sends. Shift+Enter makes a new line. Use : for emotes and / for relay commands.";
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
    };
  });

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
        this.messagesState.set([]);
        this.statusMessageState.set(null);
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

        void this.refreshMessages();
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

  async sendMessage(message: string): Promise<void> {
    const trimmedMessage = message.trim();
    const session = this.serverConnection.session();

    if (!trimmedMessage) {
      return;
    }

    if (!session) {
      this.openServerSelectHint();
      return;
    }

    this.sendingState.set(true);

    try {
      await firstValueFrom(
        this.http.post(
          this.serverConnection.serverApiUrl("/api/server/chat"),
          {
            message: trimmedMessage,
            sessionId: session.sessionId,
          },
          {
            withCredentials: true,
          },
        ),
      );
      this.statusMessageState.set(null);
      await Promise.all([this.refreshPresence(), this.refreshMessages()]);
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
      this.refreshMessages(),
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

  async refreshMessages(): Promise<void> {
    if (this.messagesRefreshInFlight) {
      return;
    }

    this.messagesRefreshInFlight = true;

    try {
      const response = await firstValueFrom(
        this.http.get<ServerChatHistoryResponse>(
          this.serverConnection.serverApiUrl("/api/server/chat"),
          {
            params: { limit: String(CHAT_LIMIT) },
            withCredentials: true,
          },
        ),
      );

      this.messagesState.set(response.entries);
    } catch (error) {
      this.messagesState.set([]);

      if (this.panelOpenState()) {
        this.statusMessageState.set(toErrorMessage(error));
      }
    } finally {
      this.messagesRefreshInFlight = false;
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
