import type {
  ActionPanelGroupKind,
  ActionPanelGroupThemeKey,
  ActionPanelGroupView
} from "../../shared/models/action-panel-group.model";
import type { QuestTag } from "./quest-log/quest-view-model";

export type ShellLayoutPreset = "story-focus" | "command-center";

export interface ShellNavItem {
  readonly label: string;
  readonly route: string;
  readonly description?: string;
}

export interface ShellStatusItem {
  readonly label: string;
  readonly value: string;
}

export interface ShellActivityItem {
  readonly title: string;
  readonly detail?: string;
}

export interface ShellTopbarAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly badge?: number;
  readonly tone: "default" | "save" | "accent" | "cool";
  readonly disabled?: boolean;
}

export type ShellActionGroupKind = ActionPanelGroupKind;
export type ShellActionGroupThemeKey = ActionPanelGroupThemeKey;

export interface ShellActionChoice {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

export interface ShellActionGroup extends ActionPanelGroupView<ShellActionChoice> {}

export interface ShellTopbarSaveSummary {
  readonly characterName?: string;
  readonly lastSaved?: string;
  /** Fallback when characterName is not set */
  readonly lead: string;
  readonly detail?: string;
}

export interface ShellSaveSlotSummary {
  readonly id: string;
  readonly name: string;
  readonly raceId: string;
  readonly classId: string;
  readonly level: number;
  readonly locationId: string;
  readonly difficultyMode: string;
  readonly expertMode: boolean;
  readonly ironmanMode: boolean;
  readonly talents: readonly string[];
  readonly portraitSrc?: string;
  readonly portraitAlt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isActive: boolean;
}

export interface ShellCharacterIdentityCard {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail?: string;
}

export interface ShellCharacterRoleLine {
  readonly label: string;
  readonly value: string;
  readonly meta?: string;
}

export interface ShellCharacterAction {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon?: string;
  readonly disabled?: boolean;
}

export interface ShellCharacterStatItem {
  readonly abbreviation: string;
  readonly label: string;
  readonly value: number;
  readonly isLocked: boolean;
  readonly tags?: readonly string[];
}

export interface ShellCharacterMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export type ShellProgressBarTone =
  | "health"
  | "mana"
  | "experience"
  | "neutral";

export interface ShellProgressBarItem {
  readonly label: string;
  readonly valueLabel: string;
  readonly current: number;
  readonly max: number;
  readonly detail?: string;
  readonly tone: ShellProgressBarTone;
  readonly gapWarning?: ShellGapWarning;
}

export interface ShellGapWarning {
  readonly title: string;
  readonly blockedOn: string | readonly string[];
  readonly needs: string | readonly string[];
  readonly doNotImplementUntil: string | readonly string[];
  readonly note?: string;
}

export interface ShellCharacterBadge {
  readonly label: string;
  readonly tone: "expert" | "mode";
}

export interface ShellCharacterFocusItem {
  readonly title: string;
  readonly detail?: string;
  readonly tone: "accent" | "cool" | "warm";
}

export interface ShellPurseCoinItem {
  readonly id: string;
  readonly label: string;
  readonly iconPath: string;
  readonly amount: number;
  readonly displayValue: string;
}

export interface ShellPursePanel {
  readonly totalDisplay: string;
  readonly coins: readonly ShellPurseCoinItem[];
  readonly currencyValue: null;
}

export interface ShellQuestTrackerObjective {
  readonly id: string;
  readonly label: string;
  readonly progressLabel: string;
  readonly completed: boolean;
}

export interface ShellQuestTrackerEntry {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly {
    id: QuestTag;
    label: string;
    emphasis: "strong" | "standard";
  }[];
  readonly status: "inactive" | "active" | "completed";
  readonly stepLabel: string;
  readonly objectiveLabel: string;
  readonly progressLabel: string;
  readonly progressPercent: number;
  readonly isTracked: boolean;
}

export interface ShellQuestTrackerPanel {
  readonly title: string;
  readonly emptyLabel: string;
  readonly entries: readonly ShellQuestTrackerEntry[];
  readonly maxVisibleEntries: number;
}

export interface ShellCharacterPanel {
  readonly portraitSrc?: string;
  readonly portraitAlt?: string;
  readonly initials: string;
  readonly rank: string;
  readonly name: string;
  readonly subtitle: string;
  readonly genderLabel?: string;
  readonly genderIconPath?: string;
  readonly roleLines: readonly ShellCharacterRoleLine[];
  readonly actions: readonly ShellCharacterAction[];
  readonly levelValue: number;
  readonly levelTitle: string;
  readonly badges: readonly ShellCharacterBadge[];
  readonly progressBars: readonly ShellProgressBarItem[];
  readonly identityCards: readonly ShellCharacterIdentityCard[];
  readonly purse: ShellPursePanel;
  readonly attributes: readonly ShellCharacterStatItem[];
  readonly skills: readonly ShellCharacterStatItem[];
  readonly focusItems: readonly ShellCharacterFocusItem[];
}

export interface ShellMiniChatMessage {
  readonly id: string;
  readonly sender: string;
  readonly text: string;
  readonly tone: "neutral" | "accent" | "warm" | "danger" | "success";
  readonly timestamp?: string;
}

export interface ShellMiniChatPanel {
  readonly title: string;
  readonly emptyLabel: string;
  readonly messages: readonly ShellMiniChatMessage[];
}
