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

export type QuestObjective =
  | AttributeObjective
  | ItemObjective
  | ActivityObjective
  | KillObjective
  | CompositeObjective;

export interface Quest {
  id: string;
  objectives: QuestObjective[];
  rewards?: unknown[];
}
