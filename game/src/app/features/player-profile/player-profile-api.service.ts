import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type {
  CharacterContentBinding,
  PlayerCharacterSummary,
  PlayerProfile,
} from "@rinner/grayvale-core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "../../core/services/server-connection.service";
import type { ServerProfile } from "../../core/services/server-profile.service";

export type PlayerCharacterContentBinding = CharacterContentBinding;

export interface PlayerProfileData extends PlayerProfile {
  readonly displayName?: string;
  readonly currentCharacterId?: string;
  readonly currentCharacterName?: string;
  readonly activeCharacterId?: string;
  readonly badges: readonly {
    type: "friend" | "guild_role" | "admin" | "moderation" | "permission";
    label: string;
  }[];
  readonly friendSummary: {
    count: number;
  };
  readonly guildSummary: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export interface CreateCharacterRequest {
  readonly name: string;
  readonly contentBinding?: {
    readonly serverName: string;
    readonly customContent: boolean;
    readonly profileToken: string;
  };
  readonly initialSnapshot?: {
    readonly portraitShardId?: string;
    readonly level?: number;
    readonly locationId?: string;
    readonly lastLocationName?: string;
  };
}

export interface RegisterCharacterRequest {
  readonly characterId: string;
  readonly characterName: string;
  readonly portraitShardId: string;
  readonly level?: number;
  readonly locationId?: string;
  readonly lastLocationName?: string;
}

export interface RegisterActiveCharacterRequest {
  readonly characterId: string;
  readonly level?: number;
  readonly locationId?: string;
  readonly lastLocationName?: string;
}

export interface UpdateProfileRequest {
  readonly displayName: string;
}

export type UnavailableCharacterReasonCategory =
  | "missing_local_save"
  | "server_incompatible"
  | "character_tamper_detected"
  | "active_character_registration_missing";

export interface CharacterCompatibilityStatus {
  readonly character: PlayerCharacterSummary;
  readonly compatible: boolean;
  readonly reason: string;
  readonly reasonCategory?: UnavailableCharacterReasonCategory;
}

@Injectable({ providedIn: "root" })
export class PlayerProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  async getProfile(): Promise<PlayerProfileData> {
    const url = this.serverConnection.serverApiUrl("/api/player/profile");
    return firstValueFrom(
      this.http.get<PlayerProfileData>(url, { withCredentials: true }),
    );
  }

  async createCharacter(request: CreateCharacterRequest): Promise<PlayerCharacterSummary> {
    const url = this.serverConnection.serverApiUrl("/api/player/characters");
    return firstValueFrom(
      this.http.post<PlayerCharacterSummary>(url, request, { withCredentials: true }),
    );
  }

  async registerCharacter(request: RegisterCharacterRequest): Promise<{
    status: "created" | "refreshed";
    character: PlayerCharacterSummary;
  }> {
    const url = this.serverConnection.serverApiUrl("/api/player/register-character");
    return firstValueFrom(
      this.http.post<{
        status: "created" | "refreshed";
        character: PlayerCharacterSummary;
      }>(url, request, { withCredentials: true }),
    );
  }

  async registerActiveCharacter(request: RegisterActiveCharacterRequest): Promise<{
    status: "activated";
    profileId: string;
    activeCharacterId: string;
    character: PlayerCharacterSummary;
  }> {
    const url = this.serverConnection.serverApiUrl("/api/player/register-active-character");
    return firstValueFrom(
      this.http.post<{
        status: "activated";
        profileId: string;
        activeCharacterId: string;
        character: PlayerCharacterSummary;
      }>(url, request, { withCredentials: true }),
    );
  }

  async deleteCharacter(characterId: string): Promise<{
    deleted: true;
    characterId: string;
  }> {
    const url = this.serverConnection.serverApiUrl(`/api/player/characters/${characterId}`);
    return firstValueFrom(
      this.http.delete<{
        deleted: true;
        characterId: string;
      }>(url, { withCredentials: true }),
    );
  }

  async updateProfile(request: UpdateProfileRequest): Promise<PlayerProfileData> {
    const url = this.serverConnection.serverApiUrl("/api/player/profile");
    return firstValueFrom(
      this.http.patch<PlayerProfileData>(url, request, { withCredentials: true }),
    );
  }

  async selectCharacter(
    characterId: string,
    snapshot?: {
      readonly portraitShardId?: string;
      readonly level?: number;
      readonly locationId?: string;
      readonly lastLocationName?: string;
    },
  ): Promise<{
    selected: boolean;
    profileId: string;
    activeCharacterId: string;
    character: PlayerCharacterSummary;
  }> {
    const url = this.serverConnection.serverApiUrl(`/api/player/characters/${characterId}/select`);
    return firstValueFrom(
      this.http.post<{
        selected: boolean;
        profileId: string;
        activeCharacterId: string;
        character: PlayerCharacterSummary;
      }>(
        url,
        snapshot ? { snapshot } : {},
        { withCredentials: true },
      ),
    );
  }

  /**
   * Check character compatibility against the current server profile.
   * A character is compatible if:
   * - It has no binding (will be bound on first connect)
   * - Server is non-custom and character is non-custom-content
   * - Character token matches current server token
   */
  checkCompatibility(
    character: PlayerCharacterSummary,
    serverProfile: ServerProfile | null,
  ): CharacterCompatibilityStatus {
    if (!serverProfile) {
      return {
        character,
        compatible: true,
        reason: "Server profile not loaded; compatibility will be checked on connect.",
      };
    }

    if (!character.contentBinding) {
      return {
        character,
        compatible: true,
        reason: "No prior binding; will be set on first connect.",
      };
    }

    if (!serverProfile.customContent) {
      if (!character.contentBinding.customContent) {
        return { character, compatible: true, reason: "Compatible with official server." };
      }

      return {
        character,
        compatible: false,
        reason: `Bound to a custom-content server ("${character.contentBinding.serverName}"). Cannot load on an official server.`,
        reasonCategory: "server_incompatible",
      };
    }

    // Custom content server — token must match.
    if (character.contentBinding.profileToken !== serverProfile.profileToken) {
      return {
        character,
        compatible: false,
        reason: `This character's server compatibility token does not match the current server. It may have been created on a different server.`,
        reasonCategory: "server_incompatible",
      };
    }

    return { character, compatible: true, reason: "Compatible with this server." };
  }
}
