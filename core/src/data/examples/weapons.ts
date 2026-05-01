import type { Weapon } from "../../core/models";

export const sampleWeapons: Weapon[] = [
  {
    id: "weapon_dagger_rustleaf",
    name: "Rustleaf Dagger",
    description: "A light blade favored by scouts and alley runners.",
    rarity: "common",
    icon: "assets/icons/weapons/rustleaf-dagger.png",
    type: "weapon",
    handedness: "oneHanded",
    class: "blade",
    subclass: "dagger",
    allowedSlots: ["mainHand", "offHand"],
    tags: ["light", "starter"],
    scaling: {
      skills: ["short_blade"],
      attributes: ["agility"],
      factors: {
        skills: 1.25,
        attributes: 0.5
      }
    }
  },
  {
    id: "weapon_longsword_graymark",
    name: "Graymark Longsword",
    description: "A dependable steel sword issued to town watch recruits.",
    rarity: "uncommon",
    icon: "assets/icons/weapons/graymark-longsword.png",
    type: "weapon",
    handedness: "oneHanded",
    class: "blade",
    subclass: "longsword",
    allowedSlots: ["mainHand"],
    tags: ["martial", "steel"],
    scaling: {
      skills: ["short_blade", "bow"],
      attributes: ["strength", "agility"],
      factors: {
        skills: 0.75,
        attributes: 0.5
      }
    }
  },
  {
    id: "weapon_bow_hollowreed",
    name: "Hollowreed Bow",
    description: "A two-handed bow cut from flexible marsh wood.",
    rarity: "rare",
    icon: "assets/icons/weapons/hollowreed-bow.png",
    type: "weapon",
    handedness: "twoHanded",
    class: "ranged",
    subclass: "bow",
    allowedSlots: ["mainHand"],
    tags: ["two-handed", "ranged"],
    scaling: {
      skills: ["bow"],
      attributes: ["agility"],
      factors: {
        skills: 1.5,
        attributes: 0.75
      }
    }
  }
];
