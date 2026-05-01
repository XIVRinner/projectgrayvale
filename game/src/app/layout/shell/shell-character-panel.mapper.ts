import type { Player, Race, Skill } from "@rinner/grayvale-core";

import type { AttributeDefinition } from "../../data/loaders/attribute-definitions.loader";
import type { CharacterCreatorClassOption } from "../../data/loaders/character-creator-options.loader";
import type {
  ShellCharacterAttribute,
  ShellCharacterBadge,
  ShellCharacterFocusItem,
  ShellCharacterIdentityCard,
  ShellCharacterPanel,
  ShellProgressBarItem
} from "./shell.types";

const EQUIPMENT_SLOT_COUNT = 6;

export interface ShellCharacterMetadata {
  readonly racesById: ReadonlyMap<string, Race>;
  readonly classesById: ReadonlyMap<string, CharacterCreatorClassOption>;
  readonly attributesById: ReadonlyMap<string, AttributeDefinition>;
  readonly skillsById: ReadonlyMap<string, Skill>;
}

export function buildShellCharacterPanel(
  activeCharacter: Player | null,
  metadata: ShellCharacterMetadata
): ShellCharacterPanel {
  if (!activeCharacter) {
    return buildEmptyCharacterPanel();
  }

  const race = metadata.racesById.get(activeCharacter.raceId);
  const classOption = metadata.classesById.get(activeCharacter.jobClass);
  const levelRank = levelToRank(activeCharacter.progression.level);
  const portraitSrc = resolvePortraitSrc(activeCharacter, race);
  const portraitLabel = describePortrait(activeCharacter);
  const genderLabel = describeGender(activeCharacter);
  const difficultyLabel = describeDifficulty(activeCharacter);
  const equippedCount = countEquippedSlots(activeCharacter);
  const inventoryStacks = Object.keys(activeCharacter.inventory.items).length;
  const inventoryQuantity = Object.values(activeCharacter.inventory.items).reduce(
    (sum, value) => sum + value,
    0
  );
  const topSkills = Object.entries(activeCharacter.skills)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
  const storyDetail = activeCharacter.story
    ? `${prettyLabel(activeCharacter.story.currentArcId)} | Chapter ${activeCharacter.story.currentChapter}`
    : "No active story arc";
  const questCount = activeCharacter.questLog
    ? Object.keys(activeCharacter.questLog.quests).length
    : 0;

  return {
    portraitSrc,
    portraitAlt: portraitSrc ? `${activeCharacter.name} portrait` : undefined,
    initials: toInitials(activeCharacter.name),
    rank: levelRank,
    name: activeCharacter.name,
    subtitle: [
      race?.name ?? prettyLabel(activeCharacter.raceId),
      classOption?.name ?? prettyLabel(activeCharacter.jobClass)
    ].join(" | "),
    roleLines: [
      {
        label: "Current Class",
        value: classOption?.name ?? prettyLabel(activeCharacter.jobClass),
        meta: `${levelRank}-Rank`
      },
      {
        label: "Lineage",
        value: race?.name ?? prettyLabel(activeCharacter.raceId),
        meta: `${genderLabel} | ${portraitLabel}`
      },
      {
        label: "Difficulty",
        value: difficultyLabel,
        meta: `Rank ${activeCharacter.adventurerRank} | ${activeCharacter.progression.experience} XP banked`
      }
    ],
    actions: [
      { label: "Character Sheet", shortLabel: "ID", icon: "pi pi-id-card" },
      { label: "Statistics", shortLabel: "ST", icon: "pi pi-chart-bar" },
      { label: "Inventory", shortLabel: "IN", icon: "pi pi-box" }
    ],
    levelLabel: `Level ${activeCharacter.progression.level}`,
    badges: buildBadges(activeCharacter, difficultyLabel),
    progressBars: buildProgressBars(activeCharacter, equippedCount, inventoryStacks, inventoryQuantity),
    identityCards: buildIdentityCards(activeCharacter, race, classOption, storyDetail, questCount, difficultyLabel),
    attributes: buildAttributes(activeCharacter, metadata),
    focusItems: buildFocusItems(activeCharacter, topSkills, portraitLabel, equippedCount, metadata)
  };
}

function buildEmptyCharacterPanel(): ShellCharacterPanel {
  return {
    initials: "UA",
    rank: "G",
    name: "Unknown Adventurer",
    subtitle: "No active save",
    roleLines: [
      { label: "Current Class", value: "Unassigned", meta: "G-Rank" },
      { label: "Lineage", value: "Unregistered", meta: "Unknown | No portrait selected" },
      { label: "Difficulty", value: "Normal", meta: "Rank 0 | 0 XP banked" }
    ],
    actions: [
      { label: "Character Sheet", shortLabel: "ID", icon: "pi pi-id-card" },
      { label: "Statistics", shortLabel: "ST", icon: "pi pi-chart-bar" },
      { label: "Inventory", shortLabel: "IN", icon: "pi pi-box" }
    ],
    levelLabel: "Level 1",
    badges: [
      { label: "Rank 0", tone: "expert" },
      { label: "Normal", tone: "mode" }
    ],
    progressBars: [
      {
        label: "Experience",
        valueLabel: "0 XP",
        current: 0,
        max: 1,
        tone: "experience",
        detail: "Create an adventurer to begin progression."
      },
      {
        label: "Equipment",
        valueLabel: "0 / 6",
        current: 0,
        max: EQUIPMENT_SLOT_COUNT,
        tone: "neutral",
        detail: "No equipped items."
      },
      {
        label: "Inventory",
        valueLabel: "0 stacks",
        current: 0,
        max: 1,
        tone: "neutral",
        detail: "No stored items."
      }
    ],
    identityCards: [
      { eyebrow: "Current Class", title: "Unassigned", detail: "Create a character to register a starting class." },
      { eyebrow: "Lineage", title: "Unknown", detail: "No race has been selected yet." },
      { eyebrow: "Difficulty", title: "Normal", detail: "New characters can choose easy, normal, or hard plus Expert and Ironman toggles." },
      { eyebrow: "Story", title: "Dormant", detail: "No active save means no story state." }
    ],
    attributes: [
      { abbreviation: "VIT", label: "Vitality", value: "0" },
      { abbreviation: "STR", label: "Strength", value: "0" },
      { abbreviation: "AGI", label: "Agility", value: "0" },
      { abbreviation: "MEN", label: "Mentality", value: "0" }
    ],
    focusItems: [
      { title: "Portrait", detail: "No portrait selected.", tone: "accent" },
      { title: "Skills", detail: "No trained skills.", tone: "cool" },
      { title: "Equipment", detail: "No equipped gear.", tone: "warm" }
    ]
  };
}

function buildBadges(activeCharacter: Player, difficultyLabel: string): readonly ShellCharacterBadge[] {
  return [
    { label: `Rank ${activeCharacter.adventurerRank}`, tone: "expert" },
    { label: difficultyLabel, tone: "mode" }
  ];
}

function buildProgressBars(
  activeCharacter: Player,
  equippedCount: number,
  inventoryStacks: number,
  inventoryQuantity: number
): readonly ShellProgressBarItem[] {
  const skillCount = Object.keys(activeCharacter.skills).length;

  return [
    {
      label: "Experience",
      valueLabel: `${activeCharacter.progression.experience} XP`,
      current: Math.max(activeCharacter.progression.experience, 0),
      max: Math.max(activeCharacter.progression.experience, 1),
      tone: "experience",
      detail: "Raw experience is stored, but next-level thresholds are not yet wired into the shell."
    },
    {
      label: "Equipment",
      valueLabel: `${equippedCount} / ${EQUIPMENT_SLOT_COUNT}`,
      current: equippedCount,
      max: EQUIPMENT_SLOT_COUNT,
      tone: "neutral",
      detail: "Filled equipment slots."
    },
    {
      label: "Skills",
      valueLabel: `${skillCount} trained`,
      current: Math.max(skillCount, 0),
      max: Math.max(skillCount, 1),
      tone: "neutral",
      detail: `${inventoryStacks} inventory stack${inventoryStacks === 1 ? "" : "s"} / ${inventoryQuantity} total item${inventoryQuantity === 1 ? "" : "s"}`
    }
  ];
}

function buildIdentityCards(
  activeCharacter: Player,
  race: Race | undefined,
  classOption: CharacterCreatorClassOption | undefined,
  storyDetail: string,
  questCount: number,
  difficultyLabel: string
): readonly ShellCharacterIdentityCard[] {
  return [
    {
      eyebrow: "Current Class",
      title: classOption?.name ?? prettyLabel(activeCharacter.jobClass),
      detail: classOption?.lore ?? "Class lore is not available for this save."
    },
    {
      eyebrow: "Lineage",
      title: race?.name ?? prettyLabel(activeCharacter.raceId),
      detail: summarizeRaceBonuses(race)
    },
    {
      eyebrow: "Difficulty",
      title: difficultyLabel,
      detail: "Saved on the player profile. Rule hooks are not active yet."
    },
    {
      eyebrow: "Story",
      title: activeCharacter.story ? "Active Arc" : "Dormant",
      detail: `${storyDetail}${questCount > 0 ? ` | ${questCount} quest${questCount === 1 ? "" : "s"} tracked` : ""}`
    }
  ];
}

function buildAttributes(
  activeCharacter: Player,
  metadata: ShellCharacterMetadata
): readonly ShellCharacterAttribute[] {
  const definitions = [...metadata.attributesById.values()];

  if (definitions.length === 0) {
    return [
      { abbreviation: "VIT", label: "Vitality", value: String(activeCharacter.attributes["vitality"] ?? 0) },
      { abbreviation: "STR", label: "Strength", value: String(activeCharacter.attributes["strength"] ?? 0) },
      { abbreviation: "AGI", label: "Agility", value: String(activeCharacter.attributes["agility"] ?? 0) },
      { abbreviation: "MEN", label: "Mentality", value: String(activeCharacter.attributes["mentality"] ?? 0) }
    ];
  }

  return definitions.map((attribute) => ({
    abbreviation: attribute.abbreviation,
    label: attribute.name,
    value: String(activeCharacter.attributes[attribute.id] ?? 0)
  }));
}

function buildFocusItems(
  activeCharacter: Player,
  topSkills: readonly [string, number][],
  portraitLabel: string,
  equippedCount: number,
  metadata: ShellCharacterMetadata
): readonly ShellCharacterFocusItem[] {
  const mainHand = activeCharacter.equippedItems.mainHand
    ? prettyLabel(activeCharacter.equippedItems.mainHand)
    : "No main-hand weapon";
  const topSkillDetail =
    topSkills.length > 0
      ? topSkills.map(([skill, value]) => `${resolveSkillLabel(skill, metadata)} ${value}`).join(" | ")
      : "No trained skills";

  return [
    {
      title: "Portrait",
      detail: portraitLabel,
      tone: "accent"
    },
    {
      title: "Skills",
      detail: topSkillDetail,
      tone: "cool"
    },
    {
      title: "Equipment",
      detail: `${mainHand} | ${equippedCount} slot${equippedCount === 1 ? "" : "s"} filled`,
      tone: "warm"
    }
  ];
}

function resolveSkillLabel(skillId: string, metadata: ShellCharacterMetadata): string {
  return metadata.skillsById.get(skillId)?.name ?? prettyLabel(skillId);
}

function summarizeRaceBonuses(race: Race | undefined): string {
  if (!race?.startingBonuses?.length) {
    return "No starting lineage bonuses listed.";
  }

  return race.startingBonuses
    .map((bonus) => `${bonus.type === "add" ? "+" : "x"}${bonus.value} ${prettyLabel(bonus.stat)}`)
    .join(" | ");
}

function resolvePortraitSrc(activeCharacter: Player, race: Race | undefined): string | undefined {
  const appearance = activeCharacter.selectedAppearance;

  if (!appearance || !race?.variants) {
    return undefined;
  }

  const portraitFile = race.variants[appearance.variant]?.[appearance.imageIndex];

  if (!portraitFile) {
    return undefined;
  }

  return `${race.imageBasePath}/${appearance.variant}/${portraitFile}`;
}

function describePortrait(activeCharacter: Player): string {
  const appearance = activeCharacter.selectedAppearance;

  if (!appearance) {
    return "No portrait";
  }

  return `${prettyLabel(appearance.variant)} ${appearance.imageIndex + 1}`;
}

function describeGender(activeCharacter: Player): string {
  if (!activeCharacter.genderId) {
    return "Unknown";
  }

  return prettyLabel(activeCharacter.genderId);
}

function describeDifficulty(activeCharacter: Player): string {
  const difficulty = activeCharacter.difficulty ?? {
    mode: "normal",
    expert: false,
    ironman: false
  };
  const modifiers: string[] = [];

  if (difficulty.expert) {
    modifiers.push("Expert");
  }

  if (difficulty.ironman) {
    modifiers.push("Ironman");
  }

  const modeLabel = prettyLabel(difficulty.mode);

  return modifiers.length > 0 ? `${modeLabel} | ${modifiers.join(" | ")}` : modeLabel;
}

function countEquippedSlots(activeCharacter: Player): number {
  return Object.values(activeCharacter.equippedItems).filter((value) => typeof value === "string").length;
}

function toInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) {
    return "UA";
  }

  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function levelToRank(level: number): string {
  if (level >= 50) {
    return "S";
  }

  if (level >= 30) {
    return "A";
  }

  if (level >= 15) {
    return "B";
  }

  if (level >= 5) {
    return "C";
  }

  return "G";
}

function prettyLabel(value: string): string {
  return value
    .replace(/^race_/, "")
    .replace(/^player_/, "")
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
