import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { setApiOriginOverride } from "../../data/api-paths";

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
  readonly playerUuid: string;
  readonly rank: ServerPlayerRank;
  readonly rankColor: string;
  readonly connectedAt: string;
}

interface PersistedDirectory {
  readonly selectedServerId: string;
  readonly customServers: readonly Omit<ServerDirectoryEntry, "isDefault">[];
}

const DEFAULT_SERVER_ID = "dev-local";
const STORAGE_KEY = "grayvale:servers:v1";
export const DEFAULT_SERVER_CLIENT_ID = "grayvale-local-client";
const DEFAULT_SERVER: ServerDirectoryEntry = {
  id: DEFAULT_SERVER_ID,
  label: "Dev (Singleplayer)",
  protocol: "http",
  host: "localhost",
  port: 3000,
  clientId: DEFAULT_SERVER_CLIENT_ID,
  isDefault: true
};

@Injectable({ providedIn: "root" })
export class ServerConnectionService {
  private readonly http = inject(HttpClient);

  private readonly customServersState = signal<readonly ServerDirectoryEntry[]>([]);
  private readonly selectedServerIdState = signal<string>(DEFAULT_SERVER_ID);
  private readonly sessionState = signal<ServerSessionState | null>(null);

  readonly servers = computed<readonly ServerDirectoryEntry[]>(() => [
    DEFAULT_SERVER,
    ...this.customServersState()
  ]);

  readonly selectedServerId = this.selectedServerIdState.asReadonly();
  readonly selectedServer = computed(
    () => this.servers().find((entry) => entry.id === this.selectedServerIdState()) ?? DEFAULT_SERVER
  );
  readonly session = this.sessionState.asReadonly();
  readonly isConnected = computed(() => this.sessionState() !== null);

  constructor() {
    this.hydrate();
    this.syncApiOrigin();
  }

  addServer(host: string, port: number, clientId: string): void {
    const endpoint = parseEndpoint(host.trim());
    const normalizedClientId = clientId.trim();

    if (!endpoint || !normalizedClientId || !Number.isInteger(port) || port <= 0) {
      throw new Error("Server host, client id, and a valid port are required.");
    }

    const nextEntry: ServerDirectoryEntry = {
      id: crypto.randomUUID(),
      label: `${endpoint.host}:${port}`,
      protocol: endpoint.protocol,
      host: endpoint.host,
      port,
      clientId: normalizedClientId,
      isDefault: false
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
  }

  async connectPlayer(playerUuid: string, password: string): Promise<ServerSessionState> {
    const selected = this.selectedServer();
    const payload = {
      playerUuid,
      password,
      clientId: selected.clientId
    };
    const joinUrl = `${this.serverBaseUrl(selected)}/api/server/join`;
    let response: JoinResponse;

    try {
      response = await firstValueFrom(this.http.post<JoinResponse>(joinUrl, payload));
    } catch (error) {
      if (isNotRegisteredError(error)) {
        const registerUrl = `${this.serverBaseUrl(selected)}/api/server/register`;
        await firstValueFrom(this.http.post(registerUrl, payload));
        response = await firstValueFrom(this.http.post<JoinResponse>(joinUrl, payload));
      } else {
        throw error;
      }
    }

    const nextSession: ServerSessionState = {
      sessionId: response.session.sessionId,
      playerUuid: response.player.playerUuid,
      rank: response.player.rank,
      rankColor: rankColorFor(response.player.rank),
      connectedAt: response.session.connectedAt
    };

    this.sessionState.set(nextSession);
    this.persist();

    return nextSession;
  }

  async grantAdmin(playerUuid: string, adminPassword: string): Promise<ServerSessionState> {
    const currentSession = this.sessionState();

    if (!currentSession) {
      throw new Error("Join the selected server before changing rank.");
    }

    const selected = this.selectedServer();
    const url = `${this.serverBaseUrl(selected)}/api/server/admin/grant`;
    const response = await firstValueFrom(
      this.http.post<AdminGrantResponse>(url, {
        sessionId: currentSession.sessionId,
        targetUuid: playerUuid,
        rank: "admin",
        adminPassword
      })
    );

    const nextSession: ServerSessionState = {
      ...currentSession,
      playerUuid: response.player.playerUuid,
      rank: response.player.rank,
      rankColor: rankColorFor(response.player.rank)
    };

    this.sessionState.set(nextSession);
    this.persist();

    return nextSession;
  }

  currentApiOrigin(): string | null {
    const selected = this.selectedServer();

    if (selected.id === DEFAULT_SERVER_ID) {
      return null;
    }

    return this.serverBaseUrl(selected);
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
        (parsed.selectedServerId === DEFAULT_SERVER_ID ||
          customServers.some((entry) => entry.id === parsed.selectedServerId))
          ? parsed.selectedServerId
          : DEFAULT_SERVER_ID;

      this.customServersState.set(customServers);
      this.selectedServerIdState.set(selectedServerId);
    } catch {
      this.customServersState.set([]);
      this.selectedServerIdState.set(DEFAULT_SERVER_ID);
    }
  }

  private persist(): void {
    const payload: PersistedDirectory = {
      selectedServerId: this.selectedServerIdState(),
      customServers: this.customServersState().map((entry) => ({
        id: entry.id,
        label: entry.label,
        protocol: entry.protocol,
        host: entry.host,
        port: entry.port,
        clientId: entry.clientId
      }))
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  private syncApiOrigin(): void {
    setApiOriginOverride(this.currentApiOrigin());
  }

  private serverBaseUrl(server: ServerDirectoryEntry): string {
    return `${server.protocol}://${server.host}:${server.port}`;
  }
}

interface JoinResponse {
  readonly session: {
    readonly sessionId: string;
    readonly connectedAt: string;
  };
  readonly player: {
    readonly playerUuid: string;
    readonly rank: ServerPlayerRank;
  };
}

interface AdminGrantResponse {
  readonly player: {
    readonly playerUuid: string;
    readonly rank: ServerPlayerRank;
  };
}

function parseCustomServer(raw: unknown): ServerDirectoryEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  const protocol =
    record["protocol"] === "https" ? "https" : "http";

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
    isDefault: false
  };
}

function isSameEndpoint(left: ServerDirectoryEntry, right: ServerDirectoryEntry): boolean {
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

  if (typeof maybeStatus !== "number" || maybeStatus !== 404) {
    return false;
  }

  const message = (error as { error?: { error?: unknown } }).error?.error;

  return message === "player_not_registered";
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

function parseEndpoint(value: string): { protocol: "http" | "https"; host: string } | null {
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
      host
    };
  }

  if (trimmed.startsWith("https://")) {
    const host = trimmed.slice("https://".length).replace(/\/+$/, "");

    if (!host) {
      return null;
    }

    return {
      protocol: "https",
      host
    };
  }

  const host = trimmed.replace(/\/+$/, "");

  if (!host) {
    return null;
  }

  return { protocol: "http", host };
}
