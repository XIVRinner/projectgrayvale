import type {
  PlayerQuestEntry,
  Quest,
  QuestObjective,
  QuestReward,
  QuestStep
} from "@rinner/grayvale-core";

import type {
  ObjectiveViewModel,
  QuestTag,
  QuestTagViewModel,
  QuestStatus,
  QuestStepState,
  QuestStepViewModel,
  QuestViewModel,
  RewardViewModel
} from "./quest-view-model";

const SYNTHETIC_QUEST_STEP_ID = "runtime_objectives";
const SYNTHETIC_QUEST_STEP_LABEL = "Objectives";
const DEFAULT_QUEST_TAG: QuestTag = "main";
const ALLOWED_QUEST_TAGS: readonly QuestTag[] = [
  "main",
  "side",
  "unlock-skill",
  "unlock-system",
  "companion",
  "daily",
  "weekly",
  "incursion",
  "secret"
];

export function createInactivePlayerQuestEntry(quest: Quest): PlayerQuestEntry {
  return {
    currentStep: getQuestSteps(quest)[0]?.id ?? SYNTHETIC_QUEST_STEP_ID,
    status: "inactive",
    completedSteps: []
  };
}

export function toQuestViewModel(
  quest: Quest,
  playerEntry: PlayerQuestEntry
): QuestViewModel {
  const authoredSteps = getQuestSteps(quest);
  const completedStepIds = new Set(
    playerEntry.status === "completed"
      ? authoredSteps.map((step) => step.id)
      : playerEntry.completedSteps ?? []
  );
  const currentStep = getCurrentStep(quest, playerEntry);
  const stepViewModels = authoredSteps.map((step) =>
    toQuestStepViewModel(quest.id, step, playerEntry, completedStepIds)
  );
  const resolvedCurrentStep =
    stepViewModels.find((step) => step.id === currentStep?.id) ?? stepViewModels[0];
  const currentObjectives = resolvedCurrentStep?.objectives ?? [];
  const currentObjective = flattenObjectives(currentObjectives)[0];
  const startRewards = (quest.startRewards ?? []).map(formatReward);
  const finalRewards = (quest.rewards ?? []).map(formatReward);
  const allObjectives = flattenObjectives(stepViewModels.flatMap((step) => step.objectives));
  const allRewards = [
    ...startRewards,
    ...stepViewModels.flatMap((step) => step.rewards),
    ...finalRewards
  ];
  const progressPercent = getQuestProgressPercent(quest, playerEntry);
  const progressText = getQuestProgressText(quest, playerEntry);
  const currentStepLabel = resolvedCurrentStep?.label ?? prettyQuestLabel(playerEntry.currentStep);
  const title = prettyQuestLabel(quest.id);
  const tags = resolveQuestTags(quest);
  const currentObjectiveLabel =
    currentObjective?.label ?? resolvedCurrentStep?.label ?? progressText;
  const currentObjectiveShortLabel =
    currentObjective?.shortLabel ?? resolvedCurrentStep?.label ?? progressText;
  const searchText = normalizeSearch([
    quest.id,
    title,
    currentStepLabel,
    ...tags.map((tag) => tag.label),
    ...allObjectives.flatMap((objective) => [
      objective.label,
      objective.shortLabel,
      objective.progressText ?? ""
    ]),
    ...allRewards.flatMap((reward) => [reward.label, reward.shortLabel, reward.stateLabel ?? ""])
  ]);

  return {
    id: quest.id,
    title,
    tags,
    status: playerEntry.status,
    statusLabel: toQuestStatusLabel(playerEntry.status),
    currentStepId: currentStep?.id,
    currentStepLabel,
    currentStep: resolvedCurrentStep,
    steps: stepViewModels,
    objectives: currentObjectives,
    allObjectives,
    startRewards,
    rewards: finalRewards,
    allRewards,
    progressPercent,
    progressText,
    currentObjectiveLabel,
    currentObjectiveShortLabel,
    isCompleted: playerEntry.status === "completed",
    isActive: playerEntry.status === "active",
    searchText
  };
}

export function getCurrentStep(
  quest: Quest,
  entry: PlayerQuestEntry
): QuestStep | undefined {
  const steps = getQuestSteps(quest);

  if (steps.length === 0) {
    return undefined;
  }

  if (entry.status === "inactive") {
    return steps[0];
  }

  if (entry.status === "completed") {
    return steps.find((step) => step.id === entry.currentStep) ?? steps.at(-1);
  }

  return steps.find((step) => step.id === entry.currentStep) ?? steps[0];
}

export function getQuestProgressPercent(
  quest: Quest,
  entry: PlayerQuestEntry
): number {
  if (!quest.steps || quest.steps.length === 0) {
    switch (entry.status) {
      case "completed":
        return 100;
      case "active":
        return 50;
      case "inactive":
        return 0;
    }
  }

  const totalStepCount = quest.steps.length;

  if (totalStepCount === 0) {
    return 0;
  }

  const completedStepCount =
    entry.status === "completed"
      ? totalStepCount
      : quest.steps.filter((step) => (entry.completedSteps ?? []).includes(step.id)).length;

  return Math.round((completedStepCount / totalStepCount) * 100);
}

export function formatObjective(
  objective: QuestObjective,
  objectiveId: string,
  isCompleted = false
): ObjectiveViewModel {
  switch (objective.type) {
    case "attribute_reached":
      return {
        id: objectiveId,
        type: objective.type,
        label: `Reach ${prettyQuestLabel(objective.attribute)} ${formatQuestNumber(objective.target)}`,
        shortLabel: `${prettyQuestLabel(objective.attribute)}: ${formatQuestNumber(objective.target)}`,
        progressText: `Target ${formatQuestNumber(objective.target)}`,
        isCompleted
      };
    case "item_collected":
      return {
        id: objectiveId,
        type: objective.type,
        label: `Collect ${prettyQuestLabel(objective.itemId)} x${formatQuestNumber(objective.quantity)}`,
        shortLabel: `${prettyQuestLabel(objective.itemId)} x${formatQuestNumber(objective.quantity)}`,
        progressText: `Target x${formatQuestNumber(objective.quantity)}`,
        isCompleted
      };
    case "activity_duration":
      return {
        id: objectiveId,
        type: objective.type,
        label: `Spend ${formatQuestNumber(objective.duration)} min in ${prettyQuestLabel(objective.activityId)}`,
        shortLabel: `${prettyQuestLabel(objective.activityId)}: ${formatQuestNumber(objective.duration)} min`,
        progressText: `Target ${formatQuestNumber(objective.duration)} min`,
        isCompleted
      };
    case "kill":
      return {
        id: objectiveId,
        type: objective.type,
        label: `Defeat ${prettyQuestLabel(objective.target)} x${formatQuestNumber(objective.count)}`,
        shortLabel: `${prettyQuestLabel(objective.target)} x${formatQuestNumber(objective.count)}`,
        progressText: `Target x${formatQuestNumber(objective.count)}`,
        isCompleted
      };
    case "composite":
      return {
        id: objectiveId,
        type: objective.type,
        label: `Complete ${objective.operator === "AND" ? "all" : "any"} objectives`,
        shortLabel: `${objective.operator} objectives`,
        isCompleted,
        children: objective.objectives.map((childObjective, index) =>
          formatObjective(childObjective, `${objectiveId}.${index}`, isCompleted)
        )
      };
  }
}

export function formatReward(reward: QuestReward): RewardViewModel {
  switch (reward.type) {
    case "attribute_unlock":
      return {
        type: reward.type,
        label: `Unlock attribute: ${prettyQuestLabel(reward.attributeId)}`,
        shortLabel: `Attribute: ${prettyQuestLabel(reward.attributeId)}`,
        stateLabel: reward.unlocked === true ? "Unlocked" : undefined
      };
    case "activity_availability":
      return {
        type: reward.type,
        label:
          reward.status === "enabled"
            ? `Enable activity: ${prettyQuestLabel(reward.activityId)}`
            : reward.status === "disabled"
              ? `Disable activity: ${prettyQuestLabel(reward.activityId)}`
              : `Lock activity: ${prettyQuestLabel(reward.activityId)}`,
        shortLabel: `Activity: ${prettyQuestLabel(reward.activityId)}`,
        stateLabel: reward.disabledReason ?? reward.status
      };
    case "skill_unlock":
      return {
        type: reward.type,
        label: `Unlock skill: ${prettyQuestLabel(reward.skillId)}`,
        shortLabel: `Skill: ${prettyQuestLabel(reward.skillId)}`,
        stateLabel: reward.unlocked === true ? "Unlocked" : undefined
      };
  }
}

export function flattenObjectives(
  objectives: readonly ObjectiveViewModel[]
): readonly ObjectiveViewModel[] {
  return objectives.flatMap((objective) => [
    objective,
    ...flattenObjectives(objective.children ?? [])
  ]);
}

export function getQuestSteps(quest: Quest): readonly QuestStep[] {
  if (quest.steps && quest.steps.length > 0) {
    return quest.steps;
  }

  return [
    {
      id: SYNTHETIC_QUEST_STEP_ID,
      label: SYNTHETIC_QUEST_STEP_LABEL,
      completion: "automatic",
      objectives: [...(quest.objectives ?? [])]
    }
  ];
}

export function prettyQuestLabel(value: string): string {
  return value
    .replace(/^quest_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatQuestNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");
}

function toQuestStepViewModel(
  questId: string,
  step: QuestStep,
  playerEntry: PlayerQuestEntry,
  completedStepIds: ReadonlySet<string>
): QuestStepViewModel {
  const state = resolveQuestStepState(step.id, playerEntry, completedStepIds);
  const stepCompleted = state === "completed";

  return {
    id: step.id,
    label: step.label ?? prettyQuestLabel(step.id),
    state,
    completion: step.completion === "manual" ? "manual" : "automatic",
    objectives: (step.objectives ?? []).map((objective, index) =>
      formatObjective(objective, `${questId}:${index}`, stepCompleted)
    ),
    rewards: (step.rewards ?? []).map(formatReward)
  };
}

function resolveQuestStepState(
  stepId: string,
  playerEntry: PlayerQuestEntry,
  completedStepIds: ReadonlySet<string>
): QuestStepState {
  if (playerEntry.status === "completed" || completedStepIds.has(stepId)) {
    return "completed";
  }

  if (playerEntry.status === "active" && playerEntry.currentStep === stepId) {
    return "current";
  }

  return "future";
}

function getQuestProgressText(quest: Quest, entry: PlayerQuestEntry): string {
  if (!quest.steps || quest.steps.length === 0) {
    switch (entry.status) {
      case "completed":
        return "Complete";
      case "active":
        return "In progress";
      case "inactive":
        return "Not started";
    }
  }

  const totalStepCount = quest.steps.length;
  const completedStepCount =
    entry.status === "completed"
      ? totalStepCount
      : quest.steps.filter((step) => (entry.completedSteps ?? []).includes(step.id)).length;

  return `${completedStepCount} / ${totalStepCount} steps`;
}

function toQuestStatusLabel(status: QuestStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "inactive":
      return "Inactive";
  }
}

function normalizeSearch(values: readonly string[]): string {
  return values.join(" ").toLocaleLowerCase();
}

function resolveQuestTags(quest: Quest): readonly QuestTagViewModel[] {
  const rawTags = readQuestTags(quest);
  const tags = rawTags.length > 0 ? rawTags : [DEFAULT_QUEST_TAG];

  return tags.map((tag) => ({
    id: tag,
    label: formatQuestTagLabel(tag),
    emphasis: tag === "main" || tag === "secret" ? "strong" : "standard"
  }));
}

function readQuestTags(quest: Quest): readonly QuestTag[] {
  const candidate = (quest as Quest & { tags?: unknown }).tags;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter((tag): tag is QuestTag =>
    typeof tag === "string" && (ALLOWED_QUEST_TAGS as readonly string[]).includes(tag)
  );
}

function formatQuestTagLabel(tag: QuestTag): string {
  switch (tag) {
    case "main":
      return "Main Story";
    case "side":
      return "Side";
    case "unlock-skill":
      return "Unlock Skill";
    case "unlock-system":
      return "Unlock System";
    case "companion":
      return "Companion";
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "incursion":
      return "Incursion";
    case "secret":
      return "Secret";
  }
}
