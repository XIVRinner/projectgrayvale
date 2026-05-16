import { DatePipe } from "@angular/common";
import { Component, input, output } from "@angular/core";

import type { SocialFriendshipView } from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-friend-list",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./server-chat-friend-list.component.html",
  styleUrl: "./server-chat-friend-list.component.scss",
})
export class ServerChatFriendListComponent {
  readonly friendships = input.required<readonly SocialFriendshipView[]>();
  readonly loading = input(false);

  readonly acceptRequested = output<string>();
  readonly rejectRequested = output<string>();
  readonly removeRequested = output<string>();
  readonly whisperRequested = output<{ profileId: string; characterName?: string }>();
  readonly addCharacterFriendRequested = output<{ profileId: string; characterId?: string }>();
  readonly addProfileFriendRequested = output<string>();

  protected accepted(): readonly SocialFriendshipView[] {
    return this.friendships().filter((entry) => entry.status === "accepted");
  }

  protected pendingIncoming(): readonly SocialFriendshipView[] {
    return this.friendships().filter((entry) => entry.status === "pending_incoming");
  }

  protected pendingOutgoing(): readonly SocialFriendshipView[] {
    return this.friendships().filter((entry) => entry.status === "pending_outgoing");
  }

  protected displayName(entry: SocialFriendshipView): string {
    return entry.counterpartDisplayName ?? entry.counterpartProfileId;
  }
}
