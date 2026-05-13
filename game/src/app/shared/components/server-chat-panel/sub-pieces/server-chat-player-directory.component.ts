import { DatePipe } from "@angular/common";
import { Component, input, output } from "@angular/core";

import type { AdminPlayerListEntryView } from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-player-directory",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./server-chat-player-directory.component.html",
  styleUrl: "./server-chat-player-directory.component.scss",
})
export class ServerChatPlayerDirectoryComponent {
  readonly entries = input.required<readonly AdminPlayerListEntryView[]>();
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly search = input("");
  readonly loading = input(false);
  readonly canAdminTools = input(false);

  readonly searchChanged = output<string>();
  readonly pageChanged = output<number>();
  readonly actionRequested = output<{
    action: "whisper" | "friend_profile" | "block" | "report" | "guild_invite" | "admin_profile";
    profileId: string;
    characterName?: string;
  }>();

  protected totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize())));
  }

  protected sortedEntries(): readonly AdminPlayerListEntryView[] {
    return [...this.entries()].sort((left, right) => {
      if (left.online !== right.online) {
        return left.online ? -1 : 1;
      }

      const leftTime = left.lastOnlineAt ? Date.parse(left.lastOnlineAt) : 0;
      const rightTime = right.lastOnlineAt ? Date.parse(right.lastOnlineAt) : 0;
      return rightTime - leftTime;
    });
  }
}
