export interface CombatScoreBreakdown {
  readonly total: number;
  readonly formula: string;
  readonly subscores: ReadonlyArray<CombatSubscore>;
}

export interface CombatSubscore {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly value: number;
  readonly contribution: number;
}

export interface PlayerCombatScoreInput {
  readonly gearScore: number;
  readonly skillProficiencyScore: number;
  readonly preferredAttributeScore: number;
}

export interface CompanionCombatScoreInput {
  readonly gearScore: number;
  readonly preferredRoleAlignmentScore: number;
  readonly starLevelScore: number;
}

export interface ExpectedLevelScoreConfig {
  readonly base: number;
  readonly perLevel: number;
  readonly milestoneOverrides?: Readonly<Record<number, number>>;
}

export interface CombatScoreComparison {
  readonly expectedScore: number;
  readonly ratioToExpected: number;
  readonly percentOfExpected: number;
  readonly tier: "underpowered" | "on_curve" | "overperforming";
}

export interface CombatScoreBottleneck {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string;
}

const PLAYER_FORMULA_TEXT = "Total = 0.50*Gear + 0.30*SkillProficiency + 0.20*PreferredAttribute";
const COMPANION_FORMULA_TEXT =
  "Total = 0.40*Gear + 0.20*PreferredRoleAlignment + 0.40*StarLevel";

const UNDERPOWERED_THRESHOLD = 0.85;
const OVERPERFORMING_THRESHOLD = 1.15;

export function computePlayerCombatScore(input: PlayerCombatScoreInput): CombatScoreBreakdown {
  return computeWeightedBreakdown(
    [
      {
        key: "gear",
        label: "Gear",
        weight: 0.5,
        value: input.gearScore
      },
      {
        key: "skill_proficiency",
        label: "Skill Proficiency",
        weight: 0.3,
        value: input.skillProficiencyScore
      },
      {
        key: "preferred_attribute",
        label: "Preferred Attribute",
        weight: 0.2,
        value: input.preferredAttributeScore
      }
    ],
    PLAYER_FORMULA_TEXT
  );
}

export function computeCompanionCombatScore(input: CompanionCombatScoreInput): CombatScoreBreakdown {
  return computeWeightedBreakdown(
    [
      {
        key: "gear",
        label: "Gear",
        weight: 0.4,
        value: input.gearScore
      },
      {
        key: "preferred_role_alignment",
        label: "Preferred Role Alignment",
        weight: 0.2,
        value: input.preferredRoleAlignmentScore
      },
      {
        key: "star_level",
        label: "Star Level",
        weight: 0.4,
        value: input.starLevelScore
      }
    ],
    COMPANION_FORMULA_TEXT
  );
}

export function computeExpectedForLevel(
  level: number,
  config: ExpectedLevelScoreConfig
): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  const overridden = config.milestoneOverrides?.[normalizedLevel];

  if (typeof overridden === "number") {
    return Math.max(0, Math.round(overridden));
  }

  return Math.max(0, Math.round(config.base + (normalizedLevel - 1) * config.perLevel));
}

export function compareCombatScore(total: number, expectedScore: number): CombatScoreComparison {
  const safeTotal = Math.max(0, total);
  const safeExpected = Math.max(1, expectedScore);
  const ratio = safeTotal / safeExpected;

  return {
    expectedScore: safeExpected,
    ratioToExpected: ratio,
    percentOfExpected: Math.round(ratio * 100),
    tier:
      ratio < UNDERPOWERED_THRESHOLD
        ? "underpowered"
        : ratio > OVERPERFORMING_THRESHOLD
          ? "overperforming"
          : "on_curve"
  };
}

export function computeTopBottlenecks(
  breakdown: CombatScoreBreakdown,
  limit = 3
): ReadonlyArray<CombatScoreBottleneck> {
  return [...breakdown.subscores]
    .sort((a, b) => a.value - b.value)
    .slice(0, Math.max(0, limit))
    .map((subscore) => ({
      key: subscore.key,
      label: subscore.label,
      value: subscore.value,
      hint: resolveHint(subscore.key)
    }));
}

function computeWeightedBreakdown(
  entries: ReadonlyArray<{
    key: string;
    label: string;
    weight: number;
    value: number;
  }>,
  formula: string
): CombatScoreBreakdown {
  const subscores = entries.map((entry) => {
    const value = clamp(entry.value);

    return {
      key: entry.key,
      label: entry.label,
      weight: entry.weight,
      value,
      contribution: roundTo2(value * entry.weight)
    } satisfies CombatSubscore;
  });

  const total = roundTo2(subscores.reduce((sum, part) => sum + part.contribution, 0));

  return {
    total,
    formula,
    subscores
  };
}

function resolveHint(key: string): string {
  switch (key) {
    case "gear":
      return "Upgrade weapon/armor quality and fill missing gear slots.";
    case "skill_proficiency":
      return "Increase matching weapon skill proficiency through repeated use.";
    case "preferred_attribute":
      return "Improve the weapon’s preferred attribute via stats and supporting gear.";
    case "preferred_role_alignment":
      return "Adjust companion setup to favor their preferred role execution.";
    case "star_level":
      return "Increase companion star progression to raise long-term combat baseline.";
    default:
      return "Strengthen this weak pillar to improve total combat score.";
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value * 100) / 100);
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}
