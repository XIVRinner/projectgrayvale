import type { Armor } from "../../core/models";

export const sampleArmor: Armor[] = [
  {
    id: "armor_hood_rainwoven",
    name: "Rainwoven Hood",
    description: "A light hood stitched for scouts and marsh travelers.",
    rarity: "common",
    icon: "assets/icons/armor/rainwoven-hood.png",
    type: "armor",
    armorType: "light",
    slot: "head",
    allowedSlots: ["head"],
    tags: ["light", "starter"],
    scaling: {
      skills: ["short_blade"],
      attributes: ["agility"],
      factors: {
        skills: 0.5,
        attributes: 0.25
      }
    }
  },
  {
    id: "armor_mail_graymark",
    name: "Graymark Mail",
    description: "A medium body piece worn by patrols along the Graymark road.",
    rarity: "uncommon",
    icon: "assets/icons/armor/graymark-mail.png",
    type: "armor",
    armorType: "medium",
    slot: "body",
    allowedSlots: ["body"],
    tags: ["medium", "martial"],
    scaling: {
      skills: ["short_blade", "bow"],
      attributes: ["vitality", "agility"],
      factors: {
        skills: 0.25,
        attributes: 0.5
      }
    }
  }
];
