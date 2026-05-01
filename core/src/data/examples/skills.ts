import type { Skill } from "../../core/models";

export const sampleSkills: Skill[] = [
  {
    id: "short_blade",
    name: "Short Blade",
    description: "Training with knives, daggers, and other compact melee weapons.",
    tags: ["combat", "melee", "short_blade"]
  },
  {
    id: "bow",
    name: "Bow",
    description: "Aptitude with bows and ranged precision.",
    tags: ["combat", "ranged"]
  },
  {
    id: "blacksmithing",
    name: "Blacksmithing",
    description: "Knowledge of forging, shaping, and maintaining metal gear.",
    tags: ["crafting"]
  }
];
