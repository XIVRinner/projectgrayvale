import {
  calculateXpRequired,
  type BalanceProfile,
  type ExperienceConfig,
  type Player,
  type Race,
  type Skill
} from "@rinner/grayvale-core";

import type { AttributeDefinition } from "../../data/loaders/attribute-definitions.loader";
import type { CharacterStatUnlockState } from "../../core/services/character-roster.service";
import type { CharacterCreatorClassOption } from "../../data/loaders/character-creator-options.loader";
import {
  reconcileHealthState,
  type SaveSlotHealthState
} from "../../core/services/health-balance";
import type {
  ShellCharacterBadge,
  ShellCharacterFocusItem,
  ShellCharacterIdentityCard,
  ShellCharacterPanel,
  ShellCharacterStatItem,
  ShellProgressBarItem
} from "./shell.types";

export interface ShellCharacterMetadata {
  readonly racesById: ReadonlyMap<string, Race>;
  readonly classesById: ReadonlyMap<string, CharacterCreatorClassOption>;
  readonly attributesById: ReadonlyMap<string, AttributeDefinition>;
  readonly skillsById: ReadonlyMap<string, Skill>;
}

export function buildShellCharacterPanel(
  activeCharacter: Player | null,
  metadata: ShellCharacterMetadata,
  statUnlocks: CharacterStatUnlockState | undefined,
  healthState: SaveSlotHealthState | null,
  balanceProfile: BalanceProfile | undefined,
  difficultyCurve: ExperienceConfig | undefined
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
  const genderIconPath = resolveGenderIconPath(activeCharacter.genderId);
  const difficultyLabel = describeDifficulty(activeCharacter);
  const equippedCount = countEquippedSlots(activeCharacter);
  const inventoryStacks = Object.keys(activeCharacter.inventory.items).length;
  const inventoryQuantity = Object.values(activeCharacter.inventory.items).reduce(
    (sum, value) => sum + value,
    0
  );
  const topSkills = Object.entries(activeCharacter.skills)
    .filter(([skillId]) => isSkillUnlocked(skillId, statUnlocks))
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
      race?.adjective ?? race?.name ?? prettyLabel(activeCharacter.raceId)
    ].join(" · "),
    genderLabel,
    genderIconPath,
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
    levelValue: activeCharacter.progression.level,
    levelTitle: `Level ${activeCharacter.progression.level}`,
    badges: buildBadges(activeCharacter, difficultyLabel),
    progressBars: buildProgressBars(activeCharacter, healthState, balanceProfile, difficultyCurve),
    identityCards: buildIdentityCards(activeCharacter, race, classOption, storyDetail, questCount, difficultyLabel),
    attributes: buildAttributes(activeCharacter, metadata, statUnlocks),
    skills: buildSkills(activeCharacter, metadata, statUnlocks),
    focusItems: buildFocusItems(activeCharacter, topSkills, portraitLabel, equippedCount, metadata, statUnlocks)
  };
}

function buildEmptyCharacterPanel(): ShellCharacterPanel {
  return {
    initials: "UA",
    rank: "G",
    name: "Unknown Adventurer",
    subtitle: "No active save",
    genderLabel: undefined,
    genderIconPath: undefined,
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
    levelValue: 1,
    levelTitle: "Level 1",
    badges: [
      { label: "Rank 0", tone: "expert" },
      { label: "Normal", tone: "mode" }
    ],
    progressBars: [
      {
        label: "Health",
        valueLabel: "0 / 0",
        current: 0,
        max: 1,
        tone: "health"
      },
      {
        label: "Experience",
        valueLabel: "0 XP",
        current: 0,
        max: 1,
        tone: "experience",
        detail: "Create an adventurer to begin progression."
      }
    ],
    identityCards: [
      { eyebrow: "Current Class", title: "Unassigned", detail: "Create a character to register a starting class." },
      { eyebrow: "Lineage", title: "Unknown", detail: "No race has been selected yet." },
      { eyebrow: "Difficulty", title: "Normal", detail: "New characters can choose easy, normal, or hard plus Expert and Ironman toggles." },
      { eyebrow: "Story", title: "Dormant", detail: "No active save means no story state." }
    ],
    attributes: [
      { abbreviation: "VIT", label: "Vitality", value: 0, isLocked: false },
      { abbreviation: "STR", label: "Strength", value: 0, isLocked: true },
      { abbreviation: "AGI", label: "Agility", value: 0, isLocked: true },
      { abbreviation: "MEN", label: "Mentality", value: 0, isLocked: true }
    ],
    skills: [],
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
  healthState: SaveSlotHealthState | null,
  balanceProfile: BalanceProfile | undefined,
  difficultyCurve: ExperienceConfig | undefined
): readonly ShellProgressBarItem[] {
  const health = reconcileHealthState(
    activeCharacter,
    healthState ?? undefined,
    balanceProfile
  );
  const experience = buildExperienceProgress(activeCharacter, difficultyCurve);

  return [
    {
      label: "Health",
      valueLabel: `${formatPoolValue(health.currentHp)} / ${formatPoolValue(health.maxHp)}`,
      current: health.currentHp,
      max: Math.max(health.maxHp, 1),
      tone: "health"
    },
    experience
  ];
}

function buildExperienceProgress(
  activeCharacter: Player,
  difficultyCurve: ExperienceConfig | undefined
): ShellProgressBarItem {
  const currentExperience = Math.max(activeCharacter.progression.experience, 0);

  if (!difficultyCurve) {
    return {
      label: "Experience",
      valueLabel: `${formatPoolValue(currentExperience)} XP`,
      current: currentExperience,
      max: Math.max(currentExperience, 1),
      tone: "experience",
      detail: `Level ${activeCharacter.progression.level} progression curve unavailable.`
    };
  }

  const threshold = Math.max(1, Math.ceil(calculateXpRequired(activeCharacter.progression.level, difficultyCurve)));
  const clampedExperience = Math.min(currentExperience, threshold);
  const remainingExperience = Math.max(threshold - currentExperience, 0);
  const nextLevel = activeCharacter.progression.level + 1;

  return {
    label: "Experience",
    valueLabel: `${formatPoolValue(clampedExperience)} / ${formatPoolValue(threshold)} XP`,
    current: clampedExperience,
    max: threshold,
    tone: "experience",
    detail:
      remainingExperience > 0
        ? `${formatPoolValue(remainingExperience)} XP to Level ${nextLevel}`
        : `Ready for Level ${nextLevel}`
  };
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
  metadata: ShellCharacterMetadata,
  statUnlocks: CharacterStatUnlockState | undefined
): readonly ShellCharacterStatItem[] {
  const definitions = [...metadata.attributesById.values()].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );

  if (definitions.length === 0) {
    return [
      {
        abbreviation: "VIT",
        label: "Vitality",
        value: activeCharacter.attributes["vitality"] ?? 0,
        isLocked: !isAttributeUnlocked("vitality", statUnlocks)
      },
      {
        abbreviation: "STR",
        label: "Strength",
        value: activeCharacter.attributes["strength"] ?? 0,
        isLocked: !isAttributeUnlocked("strength", statUnlocks)
      },
      {
        abbreviation: "AGI",
        label: "Agility",
        value: activeCharacter.attributes["agility"] ?? 0,
        isLocked: !isAttributeUnlocked("agility", statUnlocks)
      },
      {
        abbreviation: "MEN",
        label: "Mentality",
        value: activeCharacter.attributes["mentality"] ?? 0,
        isLocked: !isAttributeUnlocked("mentality", statUnlocks)
      }
    ];
  }

  return definitions.map((attribute) => ({
    abbreviation: attribute.abbreviation,
    label: attribute.name,
    value: activeCharacter.attributes[attribute.id] ?? 0,
    isLocked: !isAttributeUnlocked(attribute.id, statUnlocks)
  }));
}

function buildSkills(
  activeCharacter: Player,
  metadata: ShellCharacterMetadata,
  statUnlocks: CharacterStatUnlockState | undefined
): readonly ShellCharacterStatItem[] {
  return Object.keys(activeCharacter.skills)
    .map((skillId) => {
      const label = resolveSkillLabel(skillId, metadata);
      const value = activeCharacter.skills[skillId] ?? 0;
      const isLocked = !isSkillUnlocked(skillId, statUnlocks);

      return {
        abbreviation: buildSkillAbbreviation(label, skillId),
        label,
        value,
        isLocked,
        tags: metadata.skillsById.get(skillId)?.tags ?? []
      };
    })
    .sort(
      (left, right) =>
        Number(left.isLocked) - Number(right.isLocked) ||
        right.value - left.value ||
        left.label.localeCompare(right.label)
    );
}

function buildFocusItems(
  activeCharacter: Player,
  topSkills: readonly [string, number][],
  portraitLabel: string,
  equippedCount: number,
  metadata: ShellCharacterMetadata,
  statUnlocks: CharacterStatUnlockState | undefined
): readonly ShellCharacterFocusItem[] {
  const mainHand = activeCharacter.equippedItems.mainHand
    ? prettyLabel(activeCharacter.equippedItems.mainHand)
    : "No main-hand weapon";
  const topSkillDetail =
    topSkills.length > 0
      ? topSkills.map(([skill, value]) => `${resolveSkillLabel(skill, metadata)} ${value}`).join(" | ")
      : hasAnyTrackedSkills(activeCharacter)
        ? "All skills locked"
        : "No known skills";

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

function isAttributeUnlocked(
  attributeId: string,
  statUnlocks: CharacterStatUnlockState | undefined
): boolean {
  const unlocked = statUnlocks?.attributes[attributeId];

  if (typeof unlocked === "boolean") {
    return unlocked;
  }

  return attributeId === "vitality";
}

function isSkillUnlocked(
  skillId: string,
  statUnlocks: CharacterStatUnlockState | undefined
): boolean {
  return statUnlocks?.skills[skillId] ?? false;
}

function hasAnyTrackedSkills(
  activeCharacter: Player
): boolean {
  return Object.keys(activeCharacter.skills).length > 0;
}

function buildSkillAbbreviation(label: string, skillId: string): string {
  const words = label
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return skillId.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  // Skill records do not expose a dedicated abbreviation yet, so the shell derives a compact code for card display.
  const firstWord = words[0].toUpperCase();
  const secondWord = words[1].toUpperCase();
  const trailingConsonant = [...firstWord]
    .reverse()
    .find((character) => !"AEIOU".includes(character));

  return `${firstWord[0] ?? ""}${trailingConsonant ?? firstWord[1] ?? ""}${secondWord[0] ?? ""}`.slice(0, 3);
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

function resolveGenderIconPath(genderId: string | undefined): string | undefined {
  if (!genderId) {
    return undefined;
  }

  return `assets/images/character/gender-icons/${genderId}.svg`;
}

function formatPoolValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  }).format(value);
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
