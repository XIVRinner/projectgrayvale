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

export interface PlayerCharacterRecord extends PlayerCharacterSummary {
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlayerProfileRecord {
  readonly id: string;
  readonly displayName?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly characters: readonly PlayerCharacterRecord[];
}

export interface PlayerProfileSummary {
  readonly id: string;
  readonly displayName?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly characters: readonly PlayerCharacterSummary[];
}
