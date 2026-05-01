import type { Entity, Named } from "./base";
import type { EquippedItems } from "./equipment";
import type { ExperienceProgression } from "./progression";
import type { Inventory } from "./inventory";
import type { QuestLog } from "../quest";

export interface Player extends Entity, Named {
  race: string;
  raceId: string;
  jobClass: string;
  progression: ExperienceProgression;
  adventurerRank: number;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  selectedAppearance?: {
    variant: "warm" | "cool" | "exotic";
    imageIndex: number;
  };
  talents?: string[];
  questLog?: QuestLog;
  inventory: Inventory;
  equippedItems: EquippedItems;
}
