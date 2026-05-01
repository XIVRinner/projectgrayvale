export interface StoryChapter {
  number: number;
  title: string;
  subcaption?: string;
  styleDefinition?: string;
  isPrologue?: boolean;
}

export interface StoryArc {
  id: string;
  title: string;
  subtitle?: string;
  styleDefinition?: string;
  chapters: Record<number, StoryChapter>;
}

export interface StoryState {
  currentArcId: string;
  currentChapter: number;
  completedChapters?: number[];
}

/**
 * Continuity design notes:
 * - Story progression is rule-driven by external systems.
 * - Rules that mutate story progression should be idempotent (commonly via flags).
 * - Chapter values are conditions for guard evaluation, not events.
 *
 * This module intentionally provides only declarative data/state contracts.
 */
