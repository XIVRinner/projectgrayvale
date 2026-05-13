/**
 * Character content compatibility binding.
 * Stored per character, not per player profile, because a player may have
 * characters bound to different servers (official, custom A, custom B, etc.).
 */
export interface CharacterContentBinding {
  readonly serverName: string;
  readonly customContent: boolean;
  readonly profileToken: string;
  readonly acceptedAt: string;
}

export interface PlayerCharacterRecord {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly contentBinding: CharacterContentBinding | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlayerProfileRecord {
  readonly id: string;
  readonly displayName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly characters: readonly PlayerCharacterRecord[];
}

/** Lightweight summary used in profile list responses. */
export interface PlayerCharacterSummary {
  readonly id: string;
  readonly name: string;
  readonly contentBinding: CharacterContentBinding | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlayerProfileSummary {
  readonly id: string;
  readonly displayName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly characters: readonly PlayerCharacterSummary[];
}
