import type { Player } from "../../core/models";

export const samplePlayer: Player = {
  id: "player_lyra_dawnmere",
  name: "Lyra Dawnmere",
  description: "A novice adventurer beginning her first contract in Grayvale.",
  raceId: "race_human",
  jobClass: "wanderer",
  progression: {
    level: 3,
    experience: 145
  },
  adventurerRank: 1,
  difficulty: {
    mode: "normal",
    expert: false,
    ironman: false
  },
  genderId: "type-1",
  attributes: {
    strength: 7,
    agility: 10,
    vitality: 8,
    mentality: 6
  },
  skills: {
    short_blade: 2,
    bow: 1,
    blacksmithing: 3
  },
  questLog: {
    quests: {
      quest_graymark_intro: {
        currentStep: "report_to_captain",
        status: "active",
        completedSteps: ["accept_contract"]
      }
    }
  },
  inventory: {
    items: {
      weapon_dagger_rustleaf: 1,
      armor_hood_rainwoven: 1,
      armor_mail_graymark: 1,
      potion_minor_healing: 3,
      ration_standard: 5
    }
  },
  equippedItems: {
    mainHand: "weapon_longsword_graymark",
    head: "armor_hood_rainwoven",
    body: "armor_mail_graymark"
  }
};
