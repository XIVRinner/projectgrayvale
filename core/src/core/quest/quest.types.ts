export interface PlayerQuestEntry {
  currentStep: string;
  status: "inactive" | "active" | "completed";
  completedSteps?: string[];
}

export interface QuestLog {
  quests: Record<string, PlayerQuestEntry>;
}

export interface QuestReward {
  npcId: string;
  trust?: number;
  affection?: number;
}

export interface QuestStep {
  id: string;
  description?: string;
  nextSteps?: string[];
  rewards?: QuestReward[];
}

export interface Quest {
  id: string;
  name: string;
  description?: string;
  giverNpcId?: string;
  receiverNpcId?: string;
  steps: Record<string, QuestStep>;
  initialStep: string;
}
