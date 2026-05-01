import type { Rarity, RarityDefinition } from "./rarity.types";

export const RARITY_DEFINITIONS: Record<Rarity, RarityDefinition> = {
  trash: {
    id: "trash",
    name: "Trash",
    description: "Worn-out salvage with little market or combat value.",
    color: "#6B7280",
    tier: 0,
    behaviorHint: "Mostly sell, scrap, or use in low-value exchanges."
  },
  common: {
    id: "common",
    name: "Common",
    description: "Standard issue equipment broadly available across settlements.",
    color: "#9CA3AF",
    tier: 1
  },
  uncommon: {
    id: "uncommon",
    name: "Uncommon",
    description: "Improved craftsmanship or materials with modest distinction.",
    color: "#22C55E",
    tier: 2
  },
  rare: {
    id: "rare",
    name: "Rare",
    description: "Harder-to-find equipment tied to specialist makers or regions.",
    color: "#3B82F6",
    tier: 3
  },
  epic: {
    id: "epic",
    name: "Epic",
    description: "Renowned gear often linked to notable deeds or veteran ownership.",
    color: "#8B5CF6",
    tier: 4
  },
  legendary: {
    id: "legendary",
    name: "Legendary",
    description: "Named artifacts remembered in local songs and battle records.",
    color: "#F59E0B",
    tier: 5,
    behaviorHint: "May be tied to narrative milestones or unique provenance."
  },
  mythical: {
    id: "mythical",
    name: "Mythical",
    description: "Items whose origins blur between history, rumor, and omen.",
    color: "#EC4899",
    tier: 6,
    behaviorHint: "Suitable for lore-rich drops and world-state storytelling hooks."
  },
  ephemeral: {
    id: "ephemeral",
    name: "Ephemeral",
    description: "Transient manifestations that may not persist outside conditions.",
    color: "#06B6D4",
    tier: 3,
    behaviorHint: "Useful for temporary events or time-bound content."
  },
  primal: {
    id: "primal",
    name: "Primal",
    description: "Ancient force-bound equipment reflecting raw elemental dominance.",
    color: "#84CC16",
    tier: 7,
    behaviorHint: "Good fit for world-origin relic themes."
  },
  divine: {
    id: "divine",
    name: "Divine",
    description: "Sanctified instruments associated with celestial authority.",
    color: "#FDE047",
    tier: 8,
    behaviorHint: "Can communicate sacred affiliation without mechanical enforcement."
  },
  infernal: {
    id: "infernal",
    name: "Infernal",
    description: "Hellforged equipment marked by pacts, heat, and corruption.",
    color: "#EF4444",
    tier: 8,
    behaviorHint: "Can signal demonic provenance for quest and narrative systems."
  },
  cursed: {
    id: "cursed",
    name: "Cursed",
    description: "Afflicted gear feared for malignant histories or binding intent.",
    color: "#7C3AED",
    tier: 4,
    behaviorHint: "Use as descriptive metadata for future opt-in curse handling."
  }
};