import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";
import type {
  SocialIdentityView,
  ServerDirectConversationView,
} from "./server-chat.models";

interface DirectConversationsResponse {
  readonly conversations: readonly ServerDirectConversationView[];
}

interface DirectConversationOpenResponse {
  readonly conversationId: string;
}

interface DirectMessagesResponse {
  readonly count: number;
  readonly entries: readonly DirectMessageApiEntry[];
}

interface DirectMessageSendResponse {
  readonly conversationId: string;
  readonly message: DirectMessageApiEntry;
}

export interface DirectMessageApiEntry {
  readonly id: string;
  readonly channelId: string;
  readonly channelType: "direct";
  readonly senderProfileId?: string;
  readonly senderCharacterId?: string;
  readonly senderCharacterName?: string;
  readonly body: string;
  readonly createdAt: string;
  readonly messageType: "user" | "system" | "motd" | "moderation";
  readonly sender: SocialIdentityView;
}

@Injectable({ providedIn: "root" })
export class DirectMessageService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  loadDirectConversations(): Promise<readonly ServerDirectConversationView[]> {
    return firstValueFrom(
      this.http.get<DirectConversationsResponse>(
        this.serverConnection.serverApiUrl("/api/chat/direct"),
        { withCredentials: true },
      ),
    ).then((response) => response.conversations);
  }

  pollDirectMessages(
    conversationId: string,
    after?: string,
    limit = 60,
  ): Promise<readonly DirectMessageApiEntry[]> {
    return firstValueFrom(
      this.http.get<DirectMessagesResponse>(
        this.serverConnection.serverApiUrl(`/api/chat/direct/${conversationId}/messages`),
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

  openConversation(targetProfileId: string): Promise<string> {
    return firstValueFrom(
      this.http.post<DirectConversationOpenResponse>(
        this.serverConnection.serverApiUrl("/api/chat/direct/open"),
        {
          targetProfileId,
        },
        { withCredentials: true },
      ),
    ).then((response) => response.conversationId);
  }

  sendConversationMessage(
    conversationId: string,
    body: string,
  ): Promise<DirectMessageSendResponse> {
    return firstValueFrom(
      this.http.post<DirectMessageSendResponse>(
        this.serverConnection.serverApiUrl(`/api/chat/direct/${conversationId}/messages`),
        {
          body,
        },
        { withCredentials: true },
      ),
    );
  }

  sendWhisper(
    targetCharacterName: string,
    body: string,
  ): Promise<DirectMessageSendResponse> {
    return firstValueFrom(
      this.http.post<DirectMessageSendResponse>(
        this.serverConnection.serverApiUrl("/api/chat/direct"),
        {
          targetCharacterName,
          body,
        },
        { withCredentials: true },
      ),
    );
  }
}
