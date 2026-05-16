import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";
import type { ServerChatChannelView, SocialIdentityView } from "./server-chat.models";

interface ChatChannelsResponse {
  readonly channels: readonly ServerChatChannelView[];
}

interface ChatMessagesResponse {
  readonly count: number;
  readonly entries: readonly ChatMessageApiEntry[];
}

export interface ChatMessageApiEntry {
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

@Injectable({ providedIn: "root" })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  loadChannels(): Promise<readonly ServerChatChannelView[]> {
    return firstValueFrom(
      this.http.get<ChatChannelsResponse>(
        this.serverConnection.serverApiUrl("/api/chat/channels"),
        { withCredentials: true },
      ),
    ).then((response) => response.channels);
  }

  pollChannelMessages(
    channelId: string,
    after?: string,
    limit = 60,
  ): Promise<readonly ChatMessageApiEntry[]> {
    return firstValueFrom(
      this.http.get<ChatMessagesResponse>(
        this.serverConnection.serverApiUrl(`/api/chat/channels/${channelId}/messages`),
        {
          params: {
            limit: String(limit),
            ...(after ? { after } : {}),
          },
          withCredentials: true,
        },
      ),
    ).then((response) => response.entries);
  }

  sendChannelMessage(channelId: string, body: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/chat/channels/${channelId}/messages`),
        { body },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  joinCustomChannel(name: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/chat/channels/join"),
        { name },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  leaveCustomChannel(channelId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/chat/channels/${channelId}/leave`),
        {},
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  kickOrBanChannelMember(
    channelId: string,
    targetProfileId: string,
    action: "kick" | "ban" | "unban",
  ): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/chat/channels/${channelId}/${action}`),
        { targetProfileId },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  loadMotd(): Promise<string> {
    return firstValueFrom(
      this.http.get<{ motd: string }>(
        this.serverConnection.serverApiUrl("/api/server/motd"),
        { withCredentials: true },
      ),
    ).then((response) => response.motd);
  }
}
