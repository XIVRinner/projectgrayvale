import type { QuestLog } from "./quest.types";

export const isQuestCompleted = (log: QuestLog, questId: string): boolean =>
  log.quests[questId]?.status === "completed";

export const isQuestStepCompleted = (
  log: QuestLog,
  questId: string,
  stepId: string
): boolean => log.quests[questId]?.completedSteps?.includes(stepId) ?? false;
