import type { QuestObjective, QuestReward } from "@rinner/grayvale-core";

export type QuestStatus = "inactive" | "active" | "completed";
export type QuestStepState = "completed" | "current" | "future";
export type QuestTag =
  | "main"
  | "side"
  | "unlock-skill"
  | "unlock-system"
  | "companion"
  | "daily"
  | "weekly"
  | "incursion"
  | "secret";

export interface QuestTagViewModel {
  readonly id: QuestTag;
  readonly label: string;
  readonly emphasis: "strong" | "standard";
}

export interface ObjectiveViewModel {
  readonly id: string;
  readonly type: QuestObjective["type"];
  readonly label: string;
  readonly shortLabel: string;
  readonly progressText?: string;
  readonly isCompleted?: boolean;
  readonly children?: readonly ObjectiveViewModel[];
}

export interface RewardViewModel {
  readonly type: QuestReward["type"];
  readonly label: string;
  readonly shortLabel: string;
  readonly stateLabel?: string;
}

export interface QuestStepViewModel {
  readonly id: string;
  readonly label: string;
  readonly state: QuestStepState;
  readonly completion: "automatic" | "manual";
  readonly objectives: readonly ObjectiveViewModel[];
  readonly rewards: readonly RewardViewModel[];
}

export interface QuestViewModel {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly QuestTagViewModel[];
  readonly status: QuestStatus;
  readonly statusLabel: string;
  readonly currentStepId?: string;
  readonly currentStepLabel: string;
  readonly currentStep?: QuestStepViewModel;
  readonly steps: readonly QuestStepViewModel[];
  readonly objectives: readonly ObjectiveViewModel[];
  readonly allObjectives: readonly ObjectiveViewModel[];
  readonly startRewards: readonly RewardViewModel[];
  readonly rewards: readonly RewardViewModel[];
  readonly allRewards: readonly RewardViewModel[];
  readonly progressPercent: number;
  readonly progressText: string;
  readonly currentObjectiveLabel: string;
  readonly currentObjectiveShortLabel: string;
  readonly isCompleted: boolean;
  readonly isActive: boolean;
  readonly searchText: string;
}
