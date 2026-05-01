import type { Player, PlayerDifficultyMode, Race, RaceVariant } from "@rinner/grayvale-core";

import type {
  CharacterCreatorDifficultyOption,
  CharacterCreatorGenderOption
} from "./character-creator.config";
import type { CharacterCreatorClassOption } from "../../data/loaders/character-creator-options.loader";

export interface CharacterCreatorRaceView {
  readonly race: Race;
  readonly iconPath: string;
  readonly bonusSummary: string;
  readonly loreSummary: string;
  readonly meta: string;
  readonly statSummary: string;
}

export interface CharacterCreatorClassView {
  readonly option: CharacterCreatorClassOption;
  readonly bonusSummary: string;
  readonly lore: string;
  readonly bonusLines: readonly string[];
  readonly statSummary: string;
}

export interface CharacterCreatorDifficultyOptionView extends CharacterCreatorDifficultyOption {
  readonly statLines: readonly string[];
}

export interface CharacterCreatorViewState {
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly name: string;
  readonly genderOptions: readonly CharacterCreatorGenderOption[];
  readonly selectedGenderId: string;
  readonly selectedGenderLabel: string | null;
  readonly raceOptions: readonly CharacterCreatorRaceView[];
  readonly classOptions: readonly CharacterCreatorClassView[];
  readonly selectedRaceId: string;
  readonly selectedClassId: string;
  readonly selectedVariant: RaceVariant;
  readonly selectedPortraitIndex: number;
  readonly selectedPortraitSrc: string | null;
  readonly selectedDifficultyMode: PlayerDifficultyMode;
  readonly difficultyOptions: readonly CharacterCreatorDifficultyOptionView[];
  readonly selectedDifficultyLabel: string | null;
  readonly expertMode: boolean;
  readonly ironmanMode: boolean;
  readonly availableVariants: readonly RaceVariant[];
  readonly availablePortraits: readonly string[];
  readonly previewPlayer: Player | null;
  readonly previewError: string | null;
  readonly selectedRaceName: string | null;
  readonly selectedRaceLore: string | null;
  readonly selectedRaceBonusSummary: string | null;
  readonly selectedRaceMeta: string | null;
  readonly selectedClassName: string | null;
  readonly selectedClassLore: string | null;
  readonly selectedClassBonusSummary: string | null;
  readonly selectedClassStatSummary: string | null;
  readonly saveStatusMessage: string | null;
}
