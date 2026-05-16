import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { setApiOriginOverride } from "../../data/api-paths";
import { type ServerChatAccessState } from "./server-chat.models";
import { generatePlayerUuid } from "../utils/player-uuid";
import { ServerProfileService } from "./server-profile.service";
import type { ServerProfile } from "./server-profile.service";

export type ServerPlayerRank = "player" | "vip" | "moderator" | "admin";

export interface ServerDirectoryEntry {
  readonly id: string;
  readonly label: string;
  readonly protocol: "http" | "https";
  readonly host: string;
  readonly port: number;
  readonly clientId: string;
  readonly isDefault: boolean;
}

export interface ServerSessionState {
  readonly sessionId: string;
  readonly profileId: string;
  readonly activeCharacterId?: string;
  readonly rank: ServerPlayerRank;
  readonly rankColor: string;
  readonly chatAccess: ServerChatAccessState;
  readonly chatAccessLabel: string;
  readonly chatTimeoutUntil?: string;
  readonly chatReason?: string;
  readonly authenticatedAt: string;
  readonly connectedAt: string;
}

export interface ServerSessionModerationState {
  readonly chatAccess: ServerChatAccessState;
  readonly chatAccessLabel: string;
  readonly chatTimeoutUntil?: string;
  readonly chatReason?: string;
}

interface PersistedDirectory {
  readonly selectedServerId: string;
  readonly lastConnectedServerId?: string | null;
  readonly customServers: readonly Omit<ServerDirectoryEntry, "isDefault">[];
}

const DEFAULT_SERVER_ID = "dev-local";
const CLOUD_SERVER_ID = "grayvale-cloud-dev";
const STORAGE_KEY = "grayvale:servers:v1";
export const DEFAULT_SERVER_CLIENT_ID = "grayvale-local-client";
const AUTO_CLIENT_ID = "auto";
const DEFAULT_SERVER: ServerDirectoryEntry = {
  id: DEFAULT_SERVER_ID,
  label: "Dev (Singleplayer)",
  protocol: "http",
  host: "localhost",
  port: 3000,
  clientId: DEFAULT_SERVER_CLIENT_ID,
  isDefault: true,
};
const CLOUD_SERVER = createCloudServer();
const BUILT_IN_SERVERS = CLOUD_SERVER
  ? [DEFAULT_SERVER, CLOUD_SERVER]
  : [DEFAULT_SERVER];
const INITIAL_SERVER_ID = resolveInitialSelectedServerId(CLOUD_SERVER);

@Injectable({ providedIn: "root" })
export class ServerConnectionService {
  private readonly http = inject(HttpClient);
  private readonly serverProfileService = inject(ServerProfileService);

  private readonly customServersState = signal<readonly ServerDirectoryEntry[]>(
    [],
  );
  private readonly selectedServerIdState = signal<string>(INITIAL_SERVER_ID);
  private readonly sessionState = signal<ServerSessionState | null>(null);
  private readonly lastConnectedServerIdState = signal<string | null>(null);

  readonly servers = computed<readonly ServerDirectoryEntry[]>(() => [
    ...BUILT_IN_SERVERS,
    ...this.customServersState(),
  ]);

  readonly selectedServerId = this.selectedServerIdState.asReadonly();
  readonly selectedServer = computed(
    () =>
      this.servers().find(
        (entry) => entry.id === this.selectedServerIdState(),
      ) ?? DEFAULT_SERVER,
  );
  readonly session = this.sessionState.asReadonly();
  readonly isConnected = computed(() => this.sessionState() !== null);
  readonly canModerate = computed(() => {
    const rank = this.sessionState()?.rank;
    return rank === "moderator" || rank === "admin";
  });
  readonly canBlockServerEntry = computed(
    () => this.sessionState()?.rank === "admin",
  );

  /** The current server's public profile (fetched during connect). */
  readonly serverProfile = this.serverProfileService.currentProfile;

  constructor() {
    this.hydrate();
    this.syncApiOrigin();
    queueMicrotask(() => void this.tryRestoreSelectedServerSession());
  }

  addServer(host: string, port: number, clientId: string): void {
    const endpoint = parseEndpoint(host.trim());
    const normalizedClientId = clientId.trim();

    if (
      !endpoint ||
      !normalizedClientId ||
      !Number.isInteger(port) ||
      port <= 0
    ) {
      throw new Error("Server host, client id, and a valid port are required.");
    }

    const nextEntry: ServerDirectoryEntry = {
      id: generatePlayerUuid(),
      label: `${endpoint.host}:${port}`,
      protocol: endpoint.protocol,
      host: endpoint.host,
      port,
      clientId: normalizedClientId,
      isDefault: false,
    };

    this.customServersState.update((entries) => {
      if (entries.some((entry) => isSameEndpoint(entry, nextEntry))) {
        throw new Error("That server endpoint already exists.");
      }

      return [...entries, nextEntry];
    });

    this.selectedServerIdState.set(nextEntry.id);
    this.syncApiOrigin();
    this.persist();
  }

  selectServer(serverId: string): void {
    if (!this.servers().some((entry) => entry.id === serverId)) {
      return;
    }

    this.selectedServerIdState.set(serverId);
    this.sessionState.set(null);
    this.syncApiOrigin();
    this.persist();
    void this.tryRestoreSelectedServerSession();
  }

  disconnect(): void {
    this.sessionState.set(null);
    this.lastConnectedServerIdState.set(null);
    this.persist();
  }

  async connectPlayer(
    profileId: string,
    password: string,
    displayName?: string,
    avatarPath?: string,
  ): Promise<ServerSessionState> {
    const selected = this.selectedServer();

    // Pre-connect server profile compatibility check.
    const serverBaseUrl = this.serverBaseUrl(selected);
    const profileCheck = await this.serverProfileService.checkServerProfile(serverBaseUrl);

    if (!profileCheck.allowed) {
      const message = profileCheck.error ??
        "Server compatibility check failed. Cannot connect to this server.";
      throw new ServerProfileCompatibilityError(message, profileCheck.profile);
    }

    const clientId = await this.resolveClientId(selected);
    const payload = {
      profileId,
      password,
      clientId,
      displayName,
      avatarPath,
    };
    const joinUrl = this.serverApiUrl("/api/server/join");
    let response: JoinResponse;

    try {
      response = await firstValueFrom(
        this.http.post<JoinResponse>(joinUrl, payload, {
          withCredentials: true,
        }),
      );
    } catch (error) {
      if (isNotRegisteredError(error)) {
        const registerUrl = this.serverApiUrl("/api/server/register");
        await firstValueFrom(
          this.http.post(registerUrl, payload, {
            withCredentials: true,
          }),
        );
        response = await firstValueFrom(
          this.http.post<JoinResponse>(joinUrl, payload, {
            withCredentials: true,
          }),
        );
      } else {
        throw error;
      }
    }

    const nextSession: ServerSessionState = {
      sessionId: response.session.sessionId,
      profileId: response.session.profileId,
      activeCharacterId: response.session.activeCharacterId,
      rank: response.player.rank,
      rankColor: rankColorFor(response.player.rank),
      chatAccess: response.player.chatAccess,
      chatAccessLabel: response.player.chatAccessLabel,
      chatTimeoutUntil: response.player.chatTimeoutUntil,
      chatReason: response.player.chatReason,
      authenticatedAt: response.session.authenticatedAt,
      connectedAt: response.session.connectedAt,
    };

    this.sessionState.set(nextSession);
    this.lastConnectedServerIdState.set(selected.id);
    this.persist();

    return nextSession;
  }

  async grantAdmin(
    profileId: string,
    adminPassword: string,
  ): Promise<ServerSessionState> {
    const currentSession = this.sessionState();

    if (!currentSession) {
      throw new Error("Join the selected server before changing rank.");
    }

    const url = this.serverApiUrl("/api/server/admin/grant");
    const response = await firstValueFrom(
      this.http.post<AdminGrantResponse>(
        url,
        {
          sessionId: currentSession.sessionId,
          targetUuid: profileId,
          rank: "admin",
          adminPassword,
        },
        {
          withCredentials: true,
        },
      ),
    );

    const nextSession: ServerSessionState = {
      ...currentSession,
      rank: response.player.rank,
      rankColor: rankColorFor(response.player.rank),
      chatAccess: response.player.chatAccess,
      chatAccessLabel: response.player.chatAccessLabel,
      chatTimeoutUntil: response.player.chatTimeoutUntil,
      chatReason: response.player.chatReason,
    };

    this.sessionState.set(nextSession);
    this.persist();

    return nextSession;
  }

  async restoreSessionFromCookie(): Promise<ServerSessionState | null> {
    const response = await firstValueFrom(
      this.http.get<JoinResponse>(this.serverApiUrl("/api/server/session"), {
        withCredentials: true,
      }),
    );

    const nextSession: ServerSessionState = {
      sessionId: response.session.sessionId,
      profileId: response.session.profileId,
      activeCharacterId: response.session.activeCharacterId,
      rank: response.player.rank,
      rankColor: rankColorFor(response.player.rank),
      chatAccess: response.player.chatAccess,
      chatAccessLabel: response.player.chatAccessLabel,
      chatTimeoutUntil: response.player.chatTimeoutUntil,
      chatReason: response.player.chatReason,
      authenticatedAt: response.session.authenticatedAt,
      connectedAt: response.session.connectedAt,
    };

    this.sessionState.set(nextSession);
    this.lastConnectedServerIdState.set(this.selectedServer().id);
    this.persist();

    return nextSession;
  }

  syncSessionModeration(
    profileId: string,
    moderation: ServerSessionModerationState,
  ): void {
    const session = this.sessionState();

    if (!session || session.profileId !== profileId) {
      return;
    }

    if (
      session.chatAccess === moderation.chatAccess &&
      session.chatAccessLabel === moderation.chatAccessLabel &&
      session.chatTimeoutUntil === moderation.chatTimeoutUntil &&
      session.chatReason === moderation.chatReason
    ) {
      return;
    }

    this.sessionState.set({
      ...session,
      chatAccess: moderation.chatAccess,
      chatAccessLabel: moderation.chatAccessLabel,
      chatTimeoutUntil: moderation.chatTimeoutUntil,
      chatReason: moderation.chatReason,
    });
  }

  currentApiOrigin(): string | null {
    const selected = this.selectedServer();

    if (selected.id === DEFAULT_SERVER_ID) {
      return null;
    }

    return this.serverBaseUrl(selected);
  }

  serverApiUrl(path: `/api/${string}`): string {
    const origin = this.currentApiOrigin();

    return origin ? `${origin}${path}` : path;
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedDirectory;
      const customServers = Array.isArray(parsed.customServers)
        ? parsed.customServers
            .map((entry) => parseCustomServer(entry))
            .filter((entry): entry is ServerDirectoryEntry => entry !== null)
        : [];
      const selectedServerId =
        typeof parsed.selectedServerId === "string" &&
          (isBuiltInServerId(parsed.selectedServerId) ||
          customServers.some((entry) => entry.id === parsed.selectedServerId))
          ? parsed.selectedServerId
            : INITIAL_SERVER_ID;
      const lastConnectedServerId =
        typeof parsed.lastConnectedServerId === "string" &&
          (isBuiltInServerId(parsed.lastConnectedServerId) ||
          customServers.some(
            (entry) => entry.id === parsed.lastConnectedServerId,
          ))
          ? parsed.lastConnectedServerId
          : null;

      this.customServersState.set(customServers);
      this.selectedServerIdState.set(selectedServerId);
      this.lastConnectedServerIdState.set(lastConnectedServerId);
    } catch {
      this.customServersState.set([]);
      this.selectedServerIdState.set(INITIAL_SERVER_ID);
      this.lastConnectedServerIdState.set(null);
    }
  }

  private persist(): void {
    const payload: PersistedDirectory = {
      selectedServerId: this.selectedServerIdState(),
      lastConnectedServerId: this.lastConnectedServerIdState(),
      customServers: this.customServersState().map((entry) => ({
        id: entry.id,
        label: entry.label,
        protocol: entry.protocol,
        host: entry.host,
        port: entry.port,
        clientId: entry.clientId,
      })),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  private async tryRestoreSelectedServerSession(): Promise<void> {
    if (this.sessionState() !== null) {
      return;
    }

    if (this.lastConnectedServerIdState() !== this.selectedServerIdState()) {
      return;
    }

    try {
      await this.restoreSessionFromCookie();
    } catch {
      // Ignore missing/expired cookies and leave the connection disconnected.
    }
  }

  private syncApiOrigin(): void {
    setApiOriginOverride(this.currentApiOrigin());
  }

  private async resolveClientId(server: ServerDirectoryEntry): Promise<string> {
    if (server.clientId !== AUTO_CLIENT_ID) {
      return server.clientId;
    }

    const serverInfo = await firstValueFrom(
      this.http.get<ServerInfoResponse>(`${this.serverBaseUrl(server)}/api/server/info`),
    );

    return serverInfo.defaultClientId;
  }

  private serverBaseUrl(server: ServerDirectoryEntry): string {
    return `${server.protocol}://${server.host}:${server.port}`;
  }
}

interface JoinResponse {
  readonly session: {
    readonly sessionId: string;
    readonly profileId: string;
    readonly activeCharacterId?: string;
    readonly authenticatedAt: string;
    readonly connectedAt: string;
  };
  readonly player: {
    readonly profileId?: string;
    readonly playerUuid?: string;
    readonly rank: ServerPlayerRank;
    readonly chatAccess: ServerChatAccessState;
    readonly chatAccessLabel: string;
    readonly chatTimeoutUntil?: string;
    readonly chatReason?: string;
  };
}

interface AdminGrantResponse {
  readonly player: {
    readonly profileId?: string;
    readonly playerUuid?: string;
    readonly rank: ServerPlayerRank;
    readonly chatAccess: ServerChatAccessState;
    readonly chatAccessLabel: string;
    readonly chatTimeoutUntil?: string;
    readonly chatReason?: string;
  };
}

interface ServerInfoResponse {
  readonly defaultClientId: string;
}

function parseCustomServer(raw: unknown): ServerDirectoryEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  const protocol = record["protocol"] === "https" ? "https" : "http";

  if (
    typeof record["id"] !== "string" ||
    typeof record["label"] !== "string" ||
    typeof record["host"] !== "string" ||
    typeof record["clientId"] !== "string" ||
    typeof record["port"] !== "number" ||
    !Number.isInteger(record["port"]) ||
    record["port"] <= 0
  ) {
    return null;
  }

  return {
    id: record["id"],
    label: record["label"],
    protocol,
    host: record["host"],
    port: record["port"],
    clientId: record["clientId"],
    isDefault: false,
  };
}

function isSameEndpoint(
  left: ServerDirectoryEntry,
  right: ServerDirectoryEntry,
): boolean {
  return (
    left.protocol === right.protocol &&
    left.host.toLowerCase() === right.host.toLowerCase() &&
    left.port === right.port &&
    left.clientId.toLowerCase() === right.clientId.toLowerCase()
  );
}

function isNotRegisteredError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeStatus = (error as { status?: unknown }).status;

  if (typeof maybeStatus !== "number") {
    return false;
  }

  if (maybeStatus !== 404) {
    return false;
  }

  const message = (error as { error?: { error?: unknown } }).error?.error;

  return message === "player_not_registered";
}

/**
 * Thrown when the pre-connect server profile compatibility check fails.
 * Callers should display the message to the user and block the connection.
 */
export class ServerProfileCompatibilityError extends Error {
  constructor(
    message: string,
    readonly profile: ServerProfile | null,
  ) {
    super(message);
    this.name = "ServerProfileCompatibilityError";
  }
}

function rankColorFor(rank: ServerPlayerRank): string {
  if (rank === "admin") {
    return "var(--gv-color-accent)";
  }

  if (rank === "moderator") {
    return "var(--gv-color-accent-cool)";
  }

  if (rank === "vip") {
    return "var(--gv-color-accent-warm)";
  }

  return "var(--gv-color-text-primary)";
}

function isBuiltInServerId(serverId: string): boolean {
  return BUILT_IN_SERVERS.some((entry) => entry.id === serverId);
}

function resolveInitialSelectedServerId(
  cloudServer: ServerDirectoryEntry | null,
): string {
  if (!cloudServer) {
    return DEFAULT_SERVER_ID;
  }

  if (typeof window === "undefined") {
    return cloudServer.id;
  }

  return isLocalHostname(window.location.hostname)
    ? DEFAULT_SERVER_ID
    : cloudServer.id;
}

function createCloudServer(): ServerDirectoryEntry | null {
  const endpoint = parseAbsoluteUrl("https://grayvale-cloud-dev.vercel.app");

  if (!endpoint) {
    return null;
  }

  return {
    id: CLOUD_SERVER_ID,
    label: "GrayVale Cloud",
    protocol: endpoint.protocol,
    host: endpoint.host,
    port: endpoint.port,
    clientId: AUTO_CLIENT_ID,
    isDefault: false,
  };
}

function parseAbsoluteUrl(
  value: string,
): { protocol: "http" | "https"; host: string; port: number } | null {
  try {
    const url = new URL(value);
    const protocol = url.protocol === "https:" ? "https" : url.protocol === "http:" ? "http" : null;

    if (!protocol || !url.hostname) {
      return null;
    }

    const port = Number(url.port || (protocol === "https" ? 443 : 80));

    if (!Number.isInteger(port) || port <= 0) {
      return null;
    }

    return {
      protocol,
      host: url.hostname,
      port,
    };
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  return normalized === "localhost" || normalized === "127.0.0.1";
}

function parseEndpoint(
  value: string,
): { protocol: "http" | "https"; host: string } | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://")) {
    const host = trimmed.slice("http://".length).replace(/\/+$/, "");

    if (!host) {
      return null;
    }

    return {
      protocol: "http",
      host,
    };
  }

  if (trimmed.startsWith("https://")) {
    const host = trimmed.slice("https://".length).replace(/\/+$/, "");

    if (!host) {
      return null;
    }

    return {
      protocol: "https",
      host,
    };
  }

  const host = trimmed.replace(/\/+$/, "");

  if (!host) {
    return null;
  }

  return { protocol: "http", host };
}
