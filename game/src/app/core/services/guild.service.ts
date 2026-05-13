import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";
import type { CurrentGuildView, GuildInvitationView } from "./server-chat.models";

@Injectable({ providedIn: "root" })
export class GuildService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  loadCurrentGuild(): Promise<{ guild: CurrentGuildView | null }> {
    return firstValueFrom(
      this.http.get<{
        guild: CurrentGuildView | null;
      }>(this.serverConnection.serverApiUrl("/api/guilds/current"), {
        withCredentials: true,
      }),
    );
  }

  loadInvitations(): Promise<{ invitations: readonly GuildInvitationView[] }> {
    return firstValueFrom(
      this.http.get<{
        invitations: readonly GuildInvitationView[];
      }>(this.serverConnection.serverApiUrl("/api/guilds/invitations"), {
        withCredentials: true,
      }),
    );
  }

  createGuild(payload: { name: string; shortName: string }): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/guilds"),
        payload,
        { withCredentials: true },
      ),
    );
  }

  inviteToGuild(guildId: string, payload: {
    targetProfileId: string;
    targetCharacterId?: string;
  }): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/guilds/${guildId}/invite`),
        payload,
        { withCredentials: true },
      ),
    );
  }

  respondToInvitation(invitationId: string, accept: boolean): Promise<void> {
    const action = accept ? "accept" : "reject";
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/guilds/invitations/${invitationId}/${action}`),
        {},
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  setMemberRole(guildId: string, characterId: string, role: "guild_master" | "officer" | "member" | "recruit"): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/guilds/${guildId}/members/${characterId}/role`),
        { role },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  kickMember(guildId: string, characterId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/guilds/${guildId}/members/${characterId}/kick`),
        {},
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  leaveGuild(guildId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/guilds/${guildId}/leave`),
        {},
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }
}
