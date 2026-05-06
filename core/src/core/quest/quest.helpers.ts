import type { Quest, QuestLog, QuestStep } from "./quest.types";

export const LEGACY_RUNTIME_STEP_ID = "runtime_objectives";

export const isQuestCompleted = (log: QuestLog, questId: string): boolean =>
  log.quests[questId]?.status === "completed";

export const isQuestStepCompleted = (
  log: QuestLog,
  questId: string,
  stepId: string
): boolean => log.quests[questId]?.completedSteps?.includes(stepId) ?? false;

export const isQuestStepActive = (
  log: QuestLog,
  questId: string,
  stepId: string
): boolean => {
  const entry = log.quests[questId];

  return entry?.status === "active" && entry.currentStep === stepId;
};

export const getQuestSteps = (quest: Quest): readonly QuestStep[] => {
  if (quest.steps && quest.steps.length > 0) {
    return quest.steps;
  }

  return [
    {
      id: LEGACY_RUNTIME_STEP_ID,
      completion: "automatic",
      objectives: [...(quest.objectives ?? [])]
    }
  ];
};

export const getQuestStepById = (
  quest: Quest,
  stepId: string
): QuestStep | undefined => getQuestSteps(quest).find((step) => step.id === stepId);
