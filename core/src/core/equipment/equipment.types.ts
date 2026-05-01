import type { Id, Named } from "../models/base";
import type { Rarity } from "./rarity.types";

export type EquipmentSlot =
  | "mainHand"
  | "offHand"
  | "head"
  | "body"
  | "legs"
  | "hands";

export interface EquippedItems {
  mainHand?: Id;
  offHand?: Id;
  head?: Id;
  body?: Id;
  legs?: Id;
  hands?: Id;
}

export type ScalingRule = {
  skills: string[];
  attributes?: string[];
  factors?: {
    skills?: number;
    attributes?: number;
  };
};

export interface EquipmentItem extends Named {
  id: string;
  rarity: Rarity;
  icon?: string;
  allowedSlots: EquipmentSlot[];
  tags?: string[];
  scaling?: ScalingRule;
}
