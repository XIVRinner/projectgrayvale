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

export type ModifierCategory = "equipment" | "buff" | "debuff" | "conditional";

export interface LabeledModifier extends Modifier {
  source: string;
  category: ModifierCategory;
  active: boolean;
  special?: boolean;
}

export type StatDisplayState =
  | "buffed"
  | "nerfed"
  | "neutral"
  | "muted"
  | "special";

export interface StatBreakdown {
  stat: Stat;
  base: number;
  modifiers: ReadonlyArray<LabeledModifier>;
  final: number;
  displayState: StatDisplayState;
}
