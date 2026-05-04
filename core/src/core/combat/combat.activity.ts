import type { ActivityId, ActorId } from "./combat.ids";
import type { DifficultyId } from "./combat.enemy";

export interface CombatActivityDefinition {
  id: ActivityId;
  displayName: string;

  playerActorId: ActorId;
  enemyActorIds: ActorId[];

  prepTicks: number;
  difficulty: DifficultyId;
}
