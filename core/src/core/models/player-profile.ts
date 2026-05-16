export interface CharacterContentBinding {
  readonly serverName: string;
  readonly customContent: boolean;
  readonly profileToken: string;
  readonly acceptedAt: string;
}

export interface PlayerCharacterSummary {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly portraitShardId?: string;
  readonly level?: number;
  readonly locationId?: string;
  readonly lastLocationName?: string;
  readonly online?: boolean;
  readonly lastPlayedAt?: string;
  readonly contentBinding?: CharacterContentBinding;
  readonly guildId?: string;
  readonly guildName?: string;
}

export interface PlayerCharacter extends PlayerCharacterSummary {
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlayerProfile {
  readonly id: string;
  readonly displayName?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly characters: readonly PlayerCharacterSummary[];
}

export interface PlayerSession {
  readonly profileId: string;
  readonly activeCharacterId?: string;
  readonly authenticatedAt: string;
}

export function assertProfileCharacterDifferent(
  profileId: string,
  characterId: string,
): void {
  if (profileId === characterId) {
    throw new Error("Profile ID and Character ID must be different.");
  }
}
