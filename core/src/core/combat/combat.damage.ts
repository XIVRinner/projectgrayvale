import type { TagId } from "./combat.ids";

export type DamageType =
  | "slashing"
  | "piercing"
  | "thrusting"
  | "blunt"
  | "nature";

export interface DamageInterval {
  min: number;
  max: number;
}

export interface DamagePacket {
  damageType: DamageType;
  interval: DamageInterval;
  tags?: TagId[];
}
