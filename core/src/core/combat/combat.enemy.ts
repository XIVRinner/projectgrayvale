import type { ActorDefinition } from "./combat.actor";

export type DifficultyId =
  | "story"
  | "normal"
  | "hard"
  | "nightmare"
  | "torment"
  | "cataclysm"
  | "challenge"
  | "challenge_plus";

export interface DifficultyProfile {
  id: DifficultyId;
  displayName: string;
  xpMagicNumber: number;
}

export interface EnemyXpDefinition {
  characterXp: number;
  offensiveSkillXp: number;
  armorSkillXp: number;
}

export interface EnemyDefinition extends ActorDefinition {
  enemyType: "enemy";
  difficulty: DifficultyId;
  xp: EnemyXpDefinition;
  lootTableId?: string;
  rotationId?: string;
}
