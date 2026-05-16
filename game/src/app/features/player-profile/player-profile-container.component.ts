import { Component, computed, effect, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { Race } from "@rinner/grayvale-core";

import { ServerConnectionService } from "../../core/services/server-connection.service";
import { CharacterRosterService } from "../../core/services/character-roster.service";
import { PlayerIdentityService } from "../../core/services/player-identity.service";
import { CharacterCreatorOptionsLoader } from "../../data/loaders/character-creator-options.loader";
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
      [characterCards]="characterCards()"
      [isLoading]="isLoading()"
      [isSavingProfileName]="isSavingProfileName()"
      [errorMessage]="errorMessage()"
      [profileNameErrorMessage]="profileNameErrorMessage()"
      [profileNameDraft]="profileNameDraft()"
      (removeRequested)="onRemoveCharacter($event)"
      (profileNameDraftChanged)="profileNameDraft.set($event)"
      (profileNameSaveRequested)="onSaveProfileName($event)"
    />
  `,
})
export class PlayerProfileContainerComponent {
  private readonly profileApi = inject(PlayerProfileApiService);
  private readonly serverConnection = inject(ServerConnectionService);
  private readonly roster = inject(CharacterRosterService);
  private readonly playerIdentity = inject(PlayerIdentityService);
  private readonly characterCreatorOptions = inject(CharacterCreatorOptionsLoader);

  private readonly profileState = signal<PlayerProfileData | null>(null);
  private readonly racesByIdState = signal<ReadonlyMap<string, Race>>(new Map());
  readonly isLoading = signal(false);
  readonly isSavingProfileName = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly profileNameErrorMessage = signal<string | null>(null);
  readonly profileNameDraft = signal("");

  readonly profile = this.profileState.asReadonly();
  readonly serverProfile = this.serverConnection.serverProfile;

  readonly characterStatuses = computed<readonly CharacterCompatibilityStatus[]>(() => {
    const prof = this.profileState();
    const sp = this.serverProfile();
    const localCharacterIds = new Set(this.roster.slots().map((slot) => slot.player.id));

    if (!prof) {
      return [];
    }

    return prof.characters.map((char) => {
      const baseStatus = this.profileApi.checkCompatibility(char, sp);
      const mappedLocalCharacterId =
        this.playerIdentity.findLocalCharacterIdByServerCharacterId(char.id);

      if (
        localCharacterIds.has(char.id) ||
        (mappedLocalCharacterId !== null && localCharacterIds.has(mappedLocalCharacterId))
      ) {
        return baseStatus;
      }

      return {
        ...baseStatus,
        compatible: false,
        reasonCategory: "missing_local_save" as const,
        reason: "This character exists on this server, but this device does not have its local save data.",
      };
    });
  });

  readonly characterCards = computed<readonly CharacterCardView[]>(() => {
    const profile = this.profileState();
    const statuses = this.characterStatuses();
    const activeCharacterId = profile?.currentCharacterId ?? profile?.activeCharacterId;

    return statuses
      .map((status, index) => ({
        status,
        portraitSrc: resolvePortraitSrc(
          status.character.portraitShardId,
          this.racesByIdState(),
        ),
        active: status.character.id === activeCharacterId,
        createdOrder: index,
      }))
      .sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1;
        }

        const leftPlayedAt = parseIsoDate(left.status.character.lastPlayedAt);
        const rightPlayedAt = parseIsoDate(right.status.character.lastPlayedAt);

        if (leftPlayedAt !== rightPlayedAt) {
          return rightPlayedAt - leftPlayedAt;
        }

        return left.createdOrder - right.createdOrder;
      });
  });

  constructor() {
    void this.loadPortraitRaces();

    effect(() => {
      const profile = this.profileState();
      this.profileNameDraft.set(profile?.displayName ?? "");
      this.profileNameErrorMessage.set(null);
    });

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

  protected async onSaveProfileName(displayName: string): Promise<void> {
    const profile = this.profileState();

    if (!profile) {
      return;
    }

    const normalized = displayName.trim();

    if (!normalized) {
      this.profileNameErrorMessage.set("Profile name cannot be empty.");
      return;
    }

    if (normalized === (profile.displayName ?? "")) {
      this.profileNameErrorMessage.set(null);
      this.profileNameDraft.set(normalized);
      return;
    }

    this.isSavingProfileName.set(true);
    this.profileNameErrorMessage.set(null);

    try {
      const updated = await this.profileApi.updateProfile({ displayName: normalized });
      this.profileState.set(updated);
      this.profileNameDraft.set(updated.displayName ?? normalized);
    } catch (error) {
      this.profileNameErrorMessage.set(
        extractErrorMessage(error, "Failed to update profile name."),
      );
    } finally {
      this.isSavingProfileName.set(false);
    }
  }

  protected async onRemoveCharacter(characterId: string): Promise<void> {
    const confirmed = window.confirm(
      "Remove this character from this server profile? This does not delete the local save on this device.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.profileApi.deleteCharacter(characterId);
      await this.loadProfile();
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, "Failed to remove character."));
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

  private async loadPortraitRaces(): Promise<void> {
    try {
      const options = await firstValueFrom(this.characterCreatorOptions.load());
      this.racesByIdState.set(new Map(options.races.map((race) => [race.id, race])));
    } catch {
      this.racesByIdState.set(new Map());
    }
  }
}

interface CharacterCardView {
  readonly status: CharacterCompatibilityStatus;
  readonly portraitSrc: string | null;
  readonly active: boolean;
  readonly createdOrder: number;
}

function resolvePortraitSrc(
  portraitShardId: string | undefined,
  racesById: ReadonlyMap<string, Race>,
): string | null {
  if (!portraitShardId) {
    return null;
  }

  if (portraitShardId.startsWith("assets/")) {
    return portraitShardId;
  }

  const parsed = parsePortraitShardId(portraitShardId);

  if (!parsed) {
    return null;
  }

  const race = racesById.get(parsed.raceId);
  const portraitName = race?.variants?.[parsed.variant]?.[parsed.imageIndex];

  if (!race?.imageBasePath || !portraitName) {
    return null;
  }

  return `${race.imageBasePath}/${parsed.variant}/${portraitName}`;
}

function parsePortraitShardId(
  portraitShardId: string,
): {
  raceId: string;
  variant: "warm" | "cool" | "exotic";
  imageIndex: number;
} | null {
  const parts = portraitShardId.split(":");

  if (parts.length !== 3) {
    return null;
  }

  const raceId = parts[0]?.trim();
  const variant = parts[1]?.trim();
  const imageIndex = Number.parseInt(parts[2] ?? "", 10);

  if (!raceId || (variant !== "warm" && variant !== "cool" && variant !== "exotic")) {
    return null;
  }

  if (!Number.isInteger(imageIndex) || imageIndex < 0) {
    return null;
  }

  return {
    raceId,
    variant,
    imageIndex,
  };
}

function parseIsoDate(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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
