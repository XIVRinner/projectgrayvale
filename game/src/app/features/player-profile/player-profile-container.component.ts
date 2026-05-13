import { Component, computed, effect, inject, signal } from "@angular/core";

import { ServerConnectionService } from "../../core/services/server-connection.service";
import {
  PlayerProfileApiService,
  type CharacterCompatibilityStatus,
  type PlayerProfileData,
} from "./player-profile-api.service";
import { PlayerProfileViewComponent } from "./player-profile-view.component";

@Component({
  selector: "gv-player-profile-container",
  standalone: true,
  imports: [PlayerProfileViewComponent],
  template: `
    <gv-player-profile-view
      [profile]="profile()"
      [serverProfile]="serverProfile()"
      [characterStatuses]="characterStatuses()"
      [isLoading]="isLoading()"
      [isCreating]="isCreating()"
      [errorMessage]="errorMessage()"
      [createErrorMessage]="createErrorMessage()"
      [newCharacterName]="newCharacterName()"
      (selectRequested)="onSelectCharacter($event)"
      (createRequested)="onCreateCharacter($event)"
      (newCharacterNameChanged)="newCharacterName.set($event)"
    />
  `,
})
export class PlayerProfileContainerComponent {
  private readonly profileApi = inject(PlayerProfileApiService);
  private readonly serverConnection = inject(ServerConnectionService);

  private readonly profileState = signal<PlayerProfileData | null>(null);
  readonly isLoading = signal(false);
  readonly isCreating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly createErrorMessage = signal<string | null>(null);
  readonly newCharacterName = signal("");

  readonly profile = this.profileState.asReadonly();
  readonly serverProfile = this.serverConnection.serverProfile;

  readonly characterStatuses = computed<readonly CharacterCompatibilityStatus[]>(() => {
    const prof = this.profileState();
    const sp = this.serverProfile();

    if (!prof) {
      return [];
    }

    return prof.characters.map((char) =>
      this.profileApi.checkCompatibility(char, sp),
    );
  });

  constructor() {
    // Load (or clear) the profile whenever the connection state changes so
    // that the view updates immediately after the player connects or disconnects.
    effect(() => {
      const connected = this.serverConnection.isConnected();

      if (connected) {
        void this.loadProfile();
      } else {
        this.profileState.set(null);
        this.errorMessage.set("Connect to a server to manage your profile.");
      }
    });
  }

  protected async onSelectCharacter(characterId: string): Promise<void> {
    try {
      await this.profileApi.selectCharacter(characterId);
      // Refresh the profile after selection.
      await this.loadProfile();
    } catch (error) {
      this.createErrorMessage.set(extractErrorMessage(error, "Failed to select character."));
    }
  }

  protected async onCreateCharacter(name: string): Promise<void> {
    if (!name.trim()) {
      return;
    }

    this.isCreating.set(true);
    this.createErrorMessage.set(null);

    try {
      const sp = this.serverProfile();
      await this.profileApi.createCharacter({
        name: name.trim(),
        contentBinding: sp
          ? {
              serverName: sp.serverName,
              customContent: sp.customContent,
              profileToken: sp.profileToken,
            }
          : undefined,
      });

      this.newCharacterName.set("");
      await this.loadProfile();
    } catch (error) {
      this.createErrorMessage.set(extractErrorMessage(error, "Failed to create character."));
    } finally {
      this.isCreating.set(false);
    }
  }

  private async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const profile = await this.profileApi.getProfile();
      this.profileState.set(profile);
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, "Failed to load profile."));
    } finally {
      this.isLoading.set(false);
    }
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}
