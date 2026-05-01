import type { Entity, Named } from "./base";
import type { EquippedItems } from "./equipment";
import type { ExperienceProgression } from "./progression";
import type { Inventory } from "./inventory";
import type { QuestLog } from "../quest";
import type { StoryState } from "../story";

export type PlayerDifficultyMode = "easy" | "normal" | "hard";

export interface PlayerDifficultySettings {
  mode: PlayerDifficultyMode;
  expert: boolean;
  ironman: boolean;
}

export interface Player extends Entity, Named {
  raceId: string;
  jobClass: string;
  progression: ExperienceProgression;
  adventurerRank: number;
  difficulty?: PlayerDifficultySettings;
  genderId?: string;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  selectedAppearance?: {
    variant: "warm" | "cool" | "exotic";
    imageIndex: number;
  };
  talents?: string[];
  questLog?: QuestLog;
  story?: StoryState;
  inventory: Inventory;
  equippedItems: EquippedItems;
}
