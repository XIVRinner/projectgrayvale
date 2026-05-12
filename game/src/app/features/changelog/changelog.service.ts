import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { apiPath } from "../../data/api-paths";
import { ServerConnectionService } from "../../core/services/server-connection.service";
import { generatePlayerUuid } from "../../core/utils/player-uuid";
import type {
  ChangelogQueryOptions,
  ChangelogRelease,
  ChangelogResponse,
} from "./changelog.types";

interface UnreadCountResponse {
  readonly count: number;
}

interface MarkReadResponse {
  readonly ok: boolean;
  readonly releaseId: string;
}

const CLIENT_ID_STORAGE_KEY = "grayvale:changelog-client-id:v1";

@Injectable({ providedIn: "root" })
export class ChangelogService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);
  private readonly anonymousClientIdState = signal<string>(
    resolveAnonymousClientId(),
  );

  readonly anonymousClientId = this.anonymousClientIdState.asReadonly();
  readonly currentUserId = computed(
    () => this.serverConnection.session()?.playerUuid ?? null,
  );

  async fetchChangelog(
    options: ChangelogQueryOptions = {},
  ): Promise<ChangelogResponse> {
    return firstValueFrom(
      this.http.get<ChangelogResponse>(apiPath("changelog"), {
        params: this.buildQueryParams(options),
        withCredentials: true,
      }),
    );
  }

  async fetchLatest(
    options: ChangelogQueryOptions = {},
  ): Promise<ChangelogResponse> {
    return firstValueFrom(
      this.http.get<ChangelogResponse>(apiPath("changelog/latest"), {
        params: this.buildQueryParams(options),
        withCredentials: true,
      }),
    );
  }

  async fetchUnreadCount(): Promise<number> {
    const response = await firstValueFrom(
      this.http.get<UnreadCountResponse>(apiPath("changelog/unread-count"), {
        params: this.buildIdentityParams(),
        withCredentials: true,
      }),
    );

    return response.count;
  }

  async fetchLatestUnreadReleases(limit = 25): Promise<readonly ChangelogRelease[]> {
    const response = await this.fetchChangelog({ limit });
    return response.releases.filter((release) => !release.isRead);
  }

  async markReleaseRead(releaseId: string): Promise<MarkReadResponse> {
    return firstValueFrom(
      this.http.post<MarkReadResponse>(
        apiPath("changelog/read"),
        this.buildReadPayload(releaseId),
        {
          withCredentials: true,
        },
      ),
    );
  }

  async markReleasesRead(releaseIds: readonly string[]): Promise<void> {
    for (const releaseId of releaseIds) {
      await this.markReleaseRead(releaseId);
    }
  }

  private buildQueryParams(
    options: ChangelogQueryOptions,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {};

    if (options.limit !== undefined) {
      params["limit"] = options.limit;
    }

    if (options.type) {
      params["type"] = options.type;
    }

    if (options.audience) {
      params["audience"] = options.audience;
    }

    if (options.since) {
      params["since"] = options.since;
    }

    if (options.tag) {
      params["tag"] = options.tag;
    }

    return {
      ...params,
      ...this.buildIdentityParams(),
    };
  }

  private buildIdentityParams(): Record<string, string> {
    if (this.currentUserId()) {
      return {};
    }

    return {
      clientId: this.anonymousClientIdState(),
    };
  }

  private buildReadPayload(releaseId: string): { readonly releaseId: string; readonly clientId?: string } {
    if (this.currentUserId()) {
      return { releaseId };
    }

    return {
      releaseId,
      clientId: this.anonymousClientIdState(),
    };
  }
}

function resolveAnonymousClientId(): string {
  if (typeof localStorage === "undefined") {
    return generatePlayerUuid();
  }

  const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim();

  if (existing) {
    return existing;
  }

  const nextId = generatePlayerUuid();
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, nextId);
  return nextId;
}
