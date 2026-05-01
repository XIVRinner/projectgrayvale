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

export interface ButtonPressRecord {
  actionId: string;
  actionKind: string;
  occurredAt: string;
  locationId?: string;
  sublocationId?: string;
  payload?: Record<string, string | number | boolean>;
}

export interface PlayerInteractionState {
  totalButtonPresses: number;
  lastButtonPress?: ButtonPressRecord;
  recentButtonPresses?: ButtonPressRecord[];
}

export type PlayerActivityAvailabilityStatus = "locked" | "enabled" | "disabled";

export interface PlayerActivityAvailabilityEntry {
  status: PlayerActivityAvailabilityStatus;
  disabledReason?: string;
}

export interface PlayerActivityState {
  availability: Record<string, PlayerActivityAvailabilityEntry>;
  activeActivityId?: string | null;
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
  activityState?: PlayerActivityState;
  interactionState?: PlayerInteractionState;
  inventory: Inventory;
  equippedItems: EquippedItems;
}
