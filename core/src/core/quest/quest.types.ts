export interface PlayerQuestEntry {
  currentStep: string;
  status: "inactive" | "active" | "completed";
  completedSteps?: string[];
}

export interface QuestLog {
  quests: Record<string, PlayerQuestEntry>;
}

export type AttributeObjective = {
  type: "attribute_reached";
  attribute: string;
  target: number;
};

export type ItemObjective = {
  type: "item_collected";
  itemId: string;
  quantity: number;
};

export type ActivityObjective = {
  type: "activity_duration";
  activityId: string;
  duration: number;
};

export type KillObjective = {
  type: "kill";
  target: string;
  count: number;
};

export type CompositeObjective = {
  type: "composite";
  operator: "AND" | "OR";
  objectives: QuestObjective[];
};

export type AttributeUnlockReward = {
  type: "attribute_unlock";
  attributeId: string;
  unlocked?: boolean;
};

export type ActivityAvailabilityReward = {
  type: "activity_availability";
  activityId: string;
  status: "locked" | "enabled" | "disabled";
  disabledReason?: string;
};

export type SkillUnlockReward = {
  type: "skill_unlock";
  skillId: string;
  unlocked?: boolean;
};

export type QuestObjective =
  | AttributeObjective
  | ItemObjective
  | ActivityObjective
  | KillObjective
  | CompositeObjective;

export type QuestReward =
  | AttributeUnlockReward
  | ActivityAvailabilityReward
  | SkillUnlockReward;

export interface QuestStep {
  id: string;
  label?: string;
  completion?: "automatic" | "manual";
  objectives?: QuestObjective[];
  rewards?: QuestReward[];
}

export interface Quest {
  id: string;
  objectives?: QuestObjective[];
  steps?: QuestStep[];
  startRewards?: QuestReward[];
  rewards?: QuestReward[];
}
