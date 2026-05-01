import type { PlayerDifficultyMode } from "@rinner/grayvale-core";

export interface CharacterCreatorDifficultyOption {
  readonly id: PlayerDifficultyMode;
  readonly label: string;
  readonly description: string;
}

export interface CharacterCreatorGenderOption {
  readonly id: string;
  readonly label: string;
  readonly iconPath: string;
}

export const CHARACTER_CREATOR_DIFFICULTY_OPTIONS: readonly CharacterCreatorDifficultyOption[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Gentler baseline tuning for a more forgiving start."
  },
  {
    id: "normal",
    label: "Normal",
    description: "Default GrayVale baseline."
  },
  {
    id: "hard",
    label: "Hard",
    description: "Tighter margins and harsher progression pressure."
  }
];

export const CHARACTER_CREATOR_DIFFICULTY_DEFAULTS = {
  mode: "normal" as PlayerDifficultyMode,
  expert: false,
  ironman: false
} as const;

export const CHARACTER_CREATOR_GENDER_OPTIONS: readonly CharacterCreatorGenderOption[] = [
  {
    id: "type-1",
    label: "Type 1",
    iconPath: "assets/images/character/gender-icons/type-1.svg"
  },
  {
    id: "type-2",
    label: "Type 2",
    iconPath: "assets/images/character/gender-icons/type-2.svg"
  },
  {
    id: "type-3",
    label: "Type 3",
    iconPath: "assets/images/character/gender-icons/type-3.svg"
  }
];

export const CHARACTER_CREATOR_DEFAULT_GENDER_ID = "type-1";
