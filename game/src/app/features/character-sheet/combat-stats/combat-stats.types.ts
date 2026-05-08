import type { StatBreakdown } from "@rinner/grayvale-core";

/** View model for a single stat row within a combat stats section. */
export interface CombatStatRowView {
  key: string;
  label: string;
  breakdown: StatBreakdown;
  isLocked: boolean;
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
