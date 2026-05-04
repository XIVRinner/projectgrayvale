import type { CombatActivityDefinition } from "../../../core/combat";

export const mvpCombatActivity: CombatActivityDefinition = {
  id: "activity_coyote_mvp",
  displayName: "Coyote Encounter",
  playerActorId: "actor_player_mvp",
  enemyActorIds: ["actor_coyote"],
  prepTicks: 2,
  difficulty: "story"
};
