import type { Entity, Named } from "../models/base";
import type { EquippedItems } from "../models/equipment";
import type { NPCVisual } from "./npc.visual";

export type NPCType = "combat" | "noncombat";

export type NPCRole = "dps" | "healer" | "tank";

export interface NPCProgression {
  level: number;
  adventurerRank: number;
}

export type NPCEquipment = EquippedItems;

export interface NPC extends Entity, Named {
  visual: NPCVisual;
  type: NPCType;
  skills: Record<string, number>;
  attributes: Record<string, number>;
  progression: NPCProgression;
  affection?: number;
  trust: number;
  trustCap: number;
  starLevel: number;
  role?: NPCRole;
  availableRoles?: NPCRole[];
  equipment?: NPCEquipment;
  bonus?: string;
  raceId?: string;
  talents?: string[];
}

export type CombatNPC = NPC & {
  type: "combat";
};

export type NonCombatNPC = NPC & {
  type: "noncombat";
};
