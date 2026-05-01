import type { Player } from "../models";

export type Stat = string;

export type ModifierType = "add" | "multiply";

export interface Modifier {
  stat: Stat;
  type: ModifierType;
  value: number;
}

export type StatBlock = Record<string, number>;

export interface ModifierSourceItem {
  modifiers?: ReadonlyArray<Modifier>;
}

export type ModifierProvider = (player: Player) => Modifier[];
