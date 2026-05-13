import { Component, effect, input, output, signal, viewChild } from "@angular/core";
import { MenuItem } from "primeng/api";
import { ContextMenu, ContextMenuModule } from "primeng/contextmenu";

import {
  AdminPlayerListEntryView,
  AdminProfileDetailView,
  CurrentGuildView,
  GuildInvitationView,
  SocialFriendshipView,
  ServerChatChannelView,
  ServerChatCommandView,
  ServerChatCustomEmojiView,
  ServerChatMessageView,
  ServerChatPlayerActionRequest,
  ServerRelayProfileView,
  ServerModerationRequest,
  ServerChatPanelView,
  ServerPresencePlayerView,
} from "../../../core/services/server-chat.models";
import { ServerChatComposerComponent } from "./sub-pieces/server-chat-composer.component";
import { ServerChatAdminPanelComponent } from "./sub-pieces/server-chat-admin-panel.component";
import { ServerChatFriendListComponent } from "./sub-pieces/server-chat-friend-list.component";
import { ServerChatGuildShellComponent } from "./sub-pieces/server-chat-guild-shell.component";
import { ServerChatMessageListComponent } from "./sub-pieces/server-chat-message-list.component";
import { ServerChatModerationBannerComponent } from "./sub-pieces/server-chat-moderation-banner.component";
import { ServerChatPlayerDirectoryComponent } from "./sub-pieces/server-chat-player-directory.component";
import { ServerChatPlayerListComponent } from "./sub-pieces/server-chat-player-list.component";

@Component({
  selector: "gv-server-chat-panel",
  standalone: true,
  imports: [
    ContextMenuModule,
    ServerChatComposerComponent,
    ServerChatAdminPanelComponent,
    ServerChatFriendListComponent,
    ServerChatGuildShellComponent,
    ServerChatMessageListComponent,
    ServerChatModerationBannerComponent,
    ServerChatPlayerDirectoryComponent,
    ServerChatPlayerListComponent,
  ],
  templateUrl: "./server-chat-panel.component.html",
  styleUrl: "./server-chat-panel.component.scss",
})
export class ServerChatPanelComponent {
  readonly panel = input.required<ServerChatPanelView>();
  readonly relayProfile = input<ServerRelayProfileView | null>(null);
  readonly players = input.required<readonly ServerPresencePlayerView[]>();
  readonly messages = input.required<readonly ServerChatMessageView[]>();
  readonly customEmojis = input.required<readonly ServerChatCustomEmojiView[]>();
  readonly commands = input.required<readonly ServerChatCommandView[]>();
  readonly channels = input.required<readonly ServerChatChannelView[]>();
  readonly activeChannelId = input<string | null>(null);
  readonly currentPlayerUuid = input<string | null>(null);
  readonly statusMessage = input<string | null>(null);
  readonly canSend = input.required<boolean>();
  readonly canModerate = input(false);
  readonly canBlockServerEntry = input(false);
  readonly isSending = input.required<boolean>();
  readonly sendHint = input<string | null>(null);
  readonly selectedModerationPlayer = input<ServerPresencePlayerView | null>(null);
  readonly moderationStatusMessage = input<string | null>(null);
  readonly isModerationSubmitting = input(false);
  readonly canShowAdminPanel = input(false);
  readonly adminEntries = input.required<readonly AdminPlayerListEntryView[]>();
  readonly adminTotal = input(0);
  readonly adminPage = input(1);
  readonly adminPageSize = input(20);
  readonly adminSearch = input("");
  readonly adminLoading = input(false);
  readonly selectedAdminProfileId = input<string | null>(null);
  readonly adminProfileDetail = input<AdminProfileDetailView | null>(null);
  readonly grantablePermissions = input.required<readonly string[]>();
  readonly socialPlayers = input.required<readonly AdminPlayerListEntryView[]>();
  readonly socialPlayersTotal = input(0);
  readonly socialPlayersPage = input(1);
  readonly socialPlayersPageSize = input(20);
  readonly socialPlayersSearch = input("");
  readonly socialPlayersLoading = input(false);
  readonly friendships = input.required<readonly SocialFriendshipView[]>();
  readonly friendsLoading = input(false);
  readonly currentGuild = input<CurrentGuildView | null>(null);
  readonly guildInvitations = input.required<readonly GuildInvitationView[]>();
  readonly guildLoading = input(false);

  readonly refreshRequested = output<void>();
  readonly openServerSelectRequested = output<void>();
  readonly grantAdminRequested = output<void>();
  readonly sendRequested = output<string>();
  readonly moderatePlayerRequested = output<ServerPresencePlayerView>();
  readonly channelSelected = output<string>();
  readonly playerActionRequested = output<ServerChatPlayerActionRequest>();
  readonly moderationSubmitted = output<ServerModerationRequest>();
  readonly moderationCleared = output<void>();
  readonly adminSearchChanged = output<string>();
  readonly adminPageChanged = output<number>();
  readonly adminProfileSelected = output<string>();
  readonly adminPermissionGranted = output<{ profileId: string; permissionId: string }>();
  readonly adminPermissionRevoked = output<{ profileId: string; permissionId: string }>();
  readonly adminModerationRequested = output<{ profileId: string; action: "kick" | "ban" | "unban" | "mute" | "unmute" | "warn" }>();
  readonly adminNoteAdded = output<{ profileId: string; body: string }>();
  readonly socialPlayersSearchChanged = output<string>();
  readonly socialPlayersPageChanged = output<number>();
  readonly friendAddCharacterRequested = output<{ profileId: string; characterId?: string }>();
  readonly friendAddProfileRequested = output<string>();
  readonly friendAcceptRequested = output<string>();
  readonly friendRejectRequested = output<string>();
  readonly friendshipRemoveRequested = output<string>();
  readonly guildCreateRequested = output<{ name: string; shortName: string }>();
  readonly guildInviteRequested = output<{ guildId: string; targetProfileId: string }>();
  readonly guildInvitationResponded = output<{ invitationId: string; accept: boolean }>();
  readonly guildRoleChanged = output<{ guildId: string; characterId: string; role: "guild_master" | "officer" | "member" | "recruit" }>();
  readonly guildLeaveRequested = output<string>();
  readonly channelLeaveRequested = output<string>();
  readonly channelCloseRequested = output<string>();
  readonly channelDestroyRequested = output<string>();

  protected readonly activeRootMenu = signal<"communications" | "profile">(
    "communications",
  );
  protected readonly activePanel = signal<"chat" | "friends" | "guild" | "players" | "admin">("chat");
  protected readonly contextMenuItems = signal<MenuItem[]>([]);
  protected readonly activeContextChannelId = signal<string | null>(null);
  protected readonly selectedProfileAvatarPath = signal<string | null>(null);
  protected readonly inspectProfile = signal<InspectProfilePreview | null>(null);
  protected readonly profileAvatarOptions = PROFILE_AVATAR_OPTIONS;
  protected readonly contextMenu = viewChild<ContextMenu>("channelContextMenu");

  constructor() {
    effect(() => {
      const profileId = this.relayProfile()?.profileId;

      if (!profileId) {
        this.selectedProfileAvatarPath.set(null);
        return;
      }

      const persisted = readProfileAvatar(profileId);
      this.selectedProfileAvatarPath.set(
        persisted ?? PROFILE_AVATAR_OPTIONS[0]?.src ?? null,
      );
    });
  }

  protected selectRootMenu(menu: "communications" | "profile"): void {
    this.activeRootMenu.set(menu);
  }

  protected isRootMenuActive(menu: "communications" | "profile"): boolean {
    return this.activeRootMenu() === menu;
  }

  protected selectPanel(panel: "chat" | "friends" | "guild" | "players" | "admin"): void {
    if (panel === "admin" && !this.canShowAdminPanel()) {
      return;
    }

    this.activePanel.set(panel);
  }

  protected isPanelActive(panel: "chat" | "friends" | "guild" | "players" | "admin"): boolean {
    return this.activePanel() === panel;
  }

  protected showGrantAdmin(): boolean {
    return (
      this.panel().isConnected && this.panel().sessionRankLabel !== "ADMIN"
    );
  }

  protected activeChatSkin():
    | "default"
    | "world"
    | "help"
    | "guild"
    | "whisper" {
    const activeChannelId = this.activeChannelId();

    if (!activeChannelId) {
      return "default";
    }

    const channel = this.channels().find((entry) => entry.id === activeChannelId);

    if (!channel) {
      return "default";
    }

    if (channel.type === "direct") {
      return "whisper";
    }

    if (channel.type === "guild") {
      return "guild";
    }

    const normalizedName = channel.name.trim().toLowerCase();

    if (normalizedName === "world") {
      return "world";
    }

    if (normalizedName === "help") {
      return "help";
    }

    return "default";
  }

  protected activeChannelCanSend(): boolean {
    const activeChannelId = this.activeChannelId();

    if (!activeChannelId) {
      return false;
    }

    return (
      this.channels().find((entry) => entry.id === activeChannelId)?.type !==
      "system"
    );
  }

  protected composerHintText(): string | null {
    const activeChannelId = this.activeChannelId();
    const activeChannel = activeChannelId
      ? this.channels().find((entry) => entry.id === activeChannelId)
      : null;

    if (activeChannel?.type === "system") {
      return "System notices only. Posting is disabled in this channel.";
    }

    return this.sendHint();
  }

  protected focusMessageAuthor(message: ServerChatMessageView): void {
    if (!this.canModerate()) {
      return;
    }

    const player = this.players().find(
      (entry) => entry.playerUuid === message.playerUuid,
    );

    if (!player || player.playerUuid === this.currentPlayerUuid()) {
      return;
    }

    this.moderatePlayerRequested.emit(player);
  }

  protected handlePlayerActionRequest(request: ServerChatPlayerActionRequest): void {
    if (request.action === "inspect_profile") {
      this.openInspectProfile(request);
      return;
    }

    this.playerActionRequested.emit(request);
  }

  protected profileAvatarPath(): string | null {
    return this.selectedProfileAvatarPath();
  }

  protected selectProfileAvatar(path: string): void {
    const profileId = this.relayProfile()?.profileId;

    if (!profileId) {
      return;
    }

    this.selectedProfileAvatarPath.set(path);
    writeProfileAvatar(profileId, path);
  }

  protected profileCharacterFriendships() {
    return this.relayProfile()?.friendships.filter((entry) => entry.type === "character") ?? [];
  }

  protected profileAccountFriendships() {
    return this.relayProfile()?.friendships.filter((entry) => entry.type === "profile") ?? [];
  }

  protected closeInspectProfile(): void {
    this.inspectProfile.set(null);
  }

  protected closeChannelContextMenu(): void {
    this.activeContextChannelId.set(null);
    this.contextMenu()?.hide();
  }

  protected openChannelContextMenu(event: MouseEvent, channel: ServerChatChannelView): void {
    event.preventDefault();

    if (channel.type === "official" || channel.type === "admin" || channel.type === "system") {
      this.closeChannelContextMenu();
      return;
    }

    if (this.activeContextChannelId() === channel.id) {
      this.closeChannelContextMenu();
      return;
    }

    this.activeContextChannelId.set(channel.id);
    const items: MenuItem[] = [];

    if (channel.type === "custom") {
      items.push({
        label: "Leave Channel",
        icon: "pi pi-sign-out",
        command: () => {
          this.channelLeaveRequested.emit(channel.id);
          this.closeChannelContextMenu();
        },
      });

      if (channel.role === "owner") {
        items.push({
          label: "Destroy Channel",
          icon: "pi pi-trash",
          command: () => {
            this.channelDestroyRequested.emit(channel.id);
            this.closeChannelContextMenu();
          },
        });
      }
    } else if (channel.type === "direct") {
      items.push({
        label: "Close Conversation",
        icon: "pi pi-times",
        command: () => {
          this.channelCloseRequested.emit(channel.id);
          this.closeChannelContextMenu();
        },
      });
    } else if (channel.type === "guild") {
      items.push({
        label: "Leave Guild",
        icon: "pi pi-sign-out",
        command: () => {
          this.guildLeaveRequested.emit(this.currentGuild()?.guildId ?? "");
          this.closeChannelContextMenu();
        },
      });
    }

    if (items.length > 0) {
      this.contextMenuItems.set(items);
      this.contextMenu()?.show(event);
    }
  }

  private openInspectProfile(request: ServerChatPlayerActionRequest): void {
    const targetProfileId = request.targetProfileId.trim();

    if (!targetProfileId) {
      return;
    }

    const playerByUuid = request.targetPlayerUuid
      ? this.players().find((entry) => entry.playerUuid === request.targetPlayerUuid)
      : undefined;
    const playerByProfile =
      playerByUuid ??
      this.players().find((entry) => entry.profileId?.trim() === targetProfileId);
    const latestMessage = this.messages()
      .slice()
      .reverse()
      .find((entry) => entry.sender.profileId === targetProfileId);
    const displayName =
      request.targetCharacterName?.trim() ||
      playerByProfile?.displayName?.trim() ||
      latestMessage?.displayName?.trim() ||
      latestMessage?.sender.characterName?.trim() ||
      latestMessage?.sender.profileDisplayName?.trim() ||
      targetProfileId;

    this.inspectProfile.set({
      profileId: targetProfileId,
      displayName,
      avatarPath: playerByProfile?.avatarPath ?? latestMessage?.avatarPath,
    });
  }
}

interface InspectProfilePreview {
  readonly profileId: string;
  readonly displayName: string;
  readonly avatarPath?: string;
}

interface ProfileAvatarOption {
  readonly id: string;
  readonly label: string;
  readonly src: string;
}

const PROFILE_AVATAR_OPTIONS: readonly ProfileAvatarOption[] = [
  { id: "human", label: "Human", src: "assets/images/character/race-icons/human.png" },
  { id: "elf", label: "Elf", src: "assets/images/character/race-icons/elf.png" },
  { id: "night-elf", label: "Night Elf", src: "assets/images/character/race-icons/nelf.png" },
  { id: "catfolk", label: "Catfolk", src: "assets/images/character/race-icons/catfolk.svg" },
  { id: "oni", label: "Oni", src: "assets/images/character/race-icons/oni.png" },
  { id: "golem", label: "Golem", src: "assets/images/character/race-icons/golem.svg" },
  { id: "high-goblin", label: "High Goblin", src: "assets/images/character/race-icons/highgoblin.png" },
];

function avatarStorageKey(profileId: string): string {
  return `grayvale:relay-profile-avatar:${profileId}`;
}

function readProfileAvatar(profileId: string): string | null {
  try {
    return localStorage.getItem(avatarStorageKey(profileId));
  } catch {
    return null;
  }
}

function writeProfileAvatar(profileId: string, path: string): void {
  try {
    localStorage.setItem(avatarStorageKey(profileId), path);
  } catch {
    // Ignore browser storage failures.
  }
}
