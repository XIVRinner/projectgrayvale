import type { Entity, Named } from "./base";
import type { EquippedItems } from "./equipment";
import type { ExperienceProgression } from "./progression";
import type { Inventory } from "./inventory";
import type { QuestLog } from "../quest";

export interface Player extends Entity, Named {
  race: string;
  jobClass: string;
  progression: ExperienceProgression;
  adventurerRank: number;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  questLog?: QuestLog;
  inventory: Inventory;
  equippedItems: EquippedItems;
}
