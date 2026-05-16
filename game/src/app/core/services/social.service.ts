import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";
import type { AdminPlayerListEntryView, SocialFriendshipView } from "./server-chat.models";

@Injectable({ providedIn: "root" })
export class SocialService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  loadPlayers(input: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ total: number; entries: readonly AdminPlayerListEntryView[] }> {
    return firstValueFrom(
      this.http.get<{
        total: number;
        entries: readonly AdminPlayerListEntryView[];
      }>(
        this.serverConnection.serverApiUrl("/api/social/players"),
        {
          params: {
            page: String(input.page),
            pageSize: String(input.pageSize),
            ...(input.search ? { search: input.search } : {}),
          },
          withCredentials: true,
        },
      ),
    );
  }

  listFriends(): Promise<{ friendships: readonly SocialFriendshipView[] }> {
    return firstValueFrom(
      this.http.get<{ friendships: readonly SocialFriendshipView[] }>(
        this.serverConnection.serverApiUrl("/api/social/friends"),
        {
        withCredentials: true,
        },
      ),
    );
  }

  addFriendByName(target: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/social/friends/add"),
        { target },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  listBlocks(): Promise<unknown> {
    return firstValueFrom(
      this.http.get(this.serverConnection.serverApiUrl("/api/social/blocks"), {
        withCredentials: true,
      }),
    );
  }

  blockProfile(blockedProfileId: string, reason?: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/social/blocks"),
        { blockedProfileId, reason },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  unblockProfile(blockedProfileId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete(
        this.serverConnection.serverApiUrl(`/api/social/blocks/${blockedProfileId}`),
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  addCharacterFriend(targetProfileId: string, targetCharacterId?: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/social/friends/character"),
        { targetProfileId, targetCharacterId },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  requestProfileFriend(targetProfileId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/social/friends/profile-request"),
        { targetProfileId },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  acceptFriendRequest(friendshipId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/social/friends/${friendshipId}/accept`),
        {},
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  rejectFriendRequest(friendshipId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/social/friends/${friendshipId}/reject`),
        {},
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  removeFriendship(friendshipId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete(
        this.serverConnection.serverApiUrl(`/api/social/friends/${friendshipId}`),
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  getPrivacySettings(): Promise<unknown> {
    return firstValueFrom(
      this.http.get(this.serverConnection.serverApiUrl("/api/social/privacy"), {
        withCredentials: true,
      }),
    );
  }

  updatePrivacySettings(payload: {
    showOnlineToFriends?: boolean;
    allowFriendRequests?: boolean;
    allowWhispersFrom?: "everyone" | "friends" | "none";
  }): Promise<void> {
    return firstValueFrom(
      this.http.put(
        this.serverConnection.serverApiUrl("/api/social/privacy"),
        payload,
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  reportPlayer(payload: {
    targetProfileId?: string;
    targetMessageId?: string;
    reason: string;
  }): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/social/reports"),
        payload,
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }
}
