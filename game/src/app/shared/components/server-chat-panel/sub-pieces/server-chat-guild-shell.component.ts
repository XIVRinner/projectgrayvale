import { DatePipe } from "@angular/common";
import { Component, input, output } from "@angular/core";

import type {
  CurrentGuildView,
  GuildInvitationView,
} from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-guild-shell",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./server-chat-guild-shell.component.html",
  styleUrl: "./server-chat-guild-shell.component.scss",
})
export class ServerChatGuildShellComponent {
  readonly guild = input<CurrentGuildView | null>(null);
  readonly invitations = input.required<readonly GuildInvitationView[]>();
  readonly loading = input(false);

  readonly createGuildRequested = output<{ name: string; shortName: string }>();
  readonly inviteRequested = output<{ guildId: string; targetProfileId: string }>();
  readonly invitationResponded = output<{ invitationId: string; accept: boolean }>();
  readonly roleChangeRequested = output<{
    guildId: string;
    characterId: string;
    role: "guild_master" | "officer" | "member" | "recruit";
  }>();
  readonly leaveGuildRequested = output<string>();

  protected canManageRoles(): boolean {
    return this.guild()?.role === "guild_master";
  }

  protected canInvite(): boolean {
    const role = this.guild()?.role;
    return role === "guild_master" || role === "officer";
  }

  protected nextRole(
    currentRole: string,
  ): "guild_master" | "officer" | "member" | "recruit" {
    if (currentRole === "officer") {
      return "member";
    }

    if (currentRole === "member" || currentRole === "recruit") {
      return "officer";
    }

    return "guild_master";
  }
}
