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

export type QuestObjective =
  | AttributeObjective
  | ItemObjective
  | ActivityObjective
  | KillObjective
  | CompositeObjective;

export type QuestReward = AttributeUnlockReward | ActivityAvailabilityReward;

export interface Quest {
  id: string;
  objectives: QuestObjective[];
  rewards?: QuestReward[];
}
