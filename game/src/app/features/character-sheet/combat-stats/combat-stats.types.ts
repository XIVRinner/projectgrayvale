import type { StatBreakdown } from "@rinner/grayvale-core";

/** View model for a single stat row within a combat stats section. */
export interface CombatStatRowView {
  key: string;
  label: string;
  breakdown: StatBreakdown;
  isLocked: boolean;
  isInspectable?: boolean;
  /** Final value formatted for display (e.g. "40", "18%"). */
  formattedValue: string;
  /** Net change from base formatted for display (e.g. "+20", "-12%"), or null when unchanged. */
  formattedDelta: string | null;
}

/** View model for a named group of combat stat rows. */
export interface CombatStatGroupView {
  label: string;
  stats: CombatStatRowView[];
}

export interface CombatWeaponDamageRowView {
  key: string;
  label: string;
  intervalLabel: string;
}

export interface CombatScoreSubscoreView {
  key: string;
  label: string;
  weightPercent: number;
  value: number;
  contribution: number;
}

export interface CombatScoreBottleneckView {
  key: string;
  label: string;
  hint: string;
}

export interface CombatScoreSummaryView {
  total: number;
  formula: string;
  percentOfExpected: number;
  tierLabel: string;
  expectedScore: number;
  subscores: readonly CombatScoreSubscoreView[];
  bottlenecks: readonly CombatScoreBottleneckView[];
}
