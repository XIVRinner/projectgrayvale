import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "../../core/services/server-connection.service";
import type { ServerProfile } from "../../core/services/server-profile.service";

export interface PlayerCharacterContentBinding {
  readonly serverName: string;
  readonly customContent: boolean;
  readonly profileToken: string;
  readonly acceptedAt: string;
}

export interface PlayerCharacterSummary {
  readonly id: string;
  readonly name: string;
  readonly contentBinding: PlayerCharacterContentBinding | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlayerProfileData {
  readonly id: string;
  readonly displayName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly characters: readonly PlayerCharacterSummary[];
}

export interface CreateCharacterRequest {
  readonly name: string;
  readonly contentBinding?: {
    readonly serverName: string;
    readonly customContent: boolean;
    readonly profileToken: string;
  };
}

export interface CharacterCompatibilityStatus {
  readonly character: PlayerCharacterSummary;
  readonly compatible: boolean;
  readonly reason: string;
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

  async selectCharacter(characterId: string): Promise<{ selected: boolean; character: PlayerCharacterSummary }> {
    const url = this.serverConnection.serverApiUrl(`/api/player/characters/${characterId}/select`);
    return firstValueFrom(
      this.http.post<{ selected: boolean; character: PlayerCharacterSummary }>(
        url,
        {},
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
      };
    }

    // Custom content server — token must match.
    if (character.contentBinding.profileToken !== serverProfile.profileToken) {
      return {
        character,
        compatible: false,
        reason: `This character's server compatibility token does not match the current server. It may have been created on a different server.`,
      };
    }

    return { character, compatible: true, reason: "Compatible with this server." };
  }
}
