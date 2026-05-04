import type { DamageType } from "./combat.damage";

export type ResistanceProfile = Partial<Record<DamageType, number>>;

export type ImmunityProfile = Partial<Record<DamageType, boolean>>;
