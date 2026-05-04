import type { ActorDefinition, EnemyDefinition } from "../../../core/combat";

export const playerActor: ActorDefinition = {
  id: "actor_player_mvp",
  displayName: "Lyra Dawnmere",
  level: 3,
  maxHp: 80,
  tags: ["player", "human"],
  skills: ["skill_short_blade"],
  equipment: {
    main_hand: "item_old_dagger"
  },
  resources: [
    {
      id: "stamina",
      displayName: "Stamina",
      max: 100,
      startsAt: 100
    }
  ]
};

export const coyoteEnemy: EnemyDefinition = {
  id: "actor_coyote",
  displayName: "Coyote",
  enemyType: "enemy",
  level: 2,
  maxHp: 45,
  tags: ["beast", "canine", "outdoor", "common"],
  abilities: ["ability_coyote_scratch"],
  difficulty: "story",
  xp: {
    characterXp: 12,
    offensiveSkillXp: 5,
    armorSkillXp: 3
  },
  resistances: {
    nature: 0.1
  }
};
