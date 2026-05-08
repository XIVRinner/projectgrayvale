import type { Quest, QuestLog } from "@rinner/grayvale-core";

import type { QuestRuntimeState } from "../../core/services/quest-tracker/quest-tracker";
import {
  createInactivePlayerQuestEntry,
  flattenObjectives,
  formatQuestNumber,
  toQuestViewModel
} from "./quest-log/quest-view-model.mapper";
import type { ObjectiveViewModel, QuestViewModel } from "./quest-log/quest-view-model";
import type { ShellQuestTrackerEntry, ShellQuestTrackerPanel } from "./shell.types";

export const DEFAULT_TRACKED_QUEST_COUNT = 3;

export function buildQuestViewModels(
  quests: readonly Quest[],
  questLog: QuestLog | undefined
): readonly QuestViewModel[] {
  return quests.map((quest) =>
    toQuestViewModel(quest, questLog?.quests[quest.id] ?? createInactivePlayerQuestEntry(quest))
  );
}

export function resolveTrackedQuestIds(
  quests: readonly QuestViewModel[],
  trackedQuestIds: readonly string[],
  fallbackCount = DEFAULT_TRACKED_QUEST_COUNT
): readonly string[] {
  const activeQuestIds = quests.filter((quest) => quest.isActive).map((quest) => quest.id);
  const activeQuestIdSet = new Set(activeQuestIds);
  const activeTrackedQuestIds = trackedQuestIds.filter((questId) =>
    activeQuestIdSet.has(questId)
  );

  return activeTrackedQuestIds.length > 0
    ? activeTrackedQuestIds
    : activeQuestIds.slice(0, fallbackCount);
}

export function buildQuestTrackerPanel(
  quests: readonly QuestViewModel[],
  runtimeStates: readonly QuestRuntimeState[],
  trackedQuestIds: readonly string[],
  maxVisibleEntries = DEFAULT_TRACKED_QUEST_COUNT
): ShellQuestTrackerPanel {
  const runtimeByQuestId = new Map(runtimeStates.map((state) => [state.questId, state]));
  const trackedQuestIdSet = new Set(trackedQuestIds);
  const activeEntries = quests
    .filter((quest) => quest.isActive)
    .sort((left, right) => compareTrackedQuestPriority(left, right, trackedQuestIdSet))
    .map((quest) =>
      buildQuestTrackerEntry(quest, runtimeByQuestId.get(quest.id), trackedQuestIdSet.has(quest.id))
    );

  return {
    title: "Quests",
    emptyLabel: "No active quests.",
    entries: activeEntries,
    maxVisibleEntries
  };
}

function buildQuestTrackerEntry(
  quest: QuestViewModel,
  runtimeState: QuestRuntimeState | undefined,
  isTracked: boolean
): ShellQuestTrackerEntry {
  const currentLeafObjectives = flattenObjectives(quest.objectives).filter(
    (objective) => !objective.children || objective.children.length === 0
  );
  const objective = selectTrackerObjective(currentLeafObjectives, runtimeState);

  return {
    id: quest.id,
    title: quest.title,
    tags: quest.tags,
    status: quest.status,
    stepLabel: quest.currentStepLabel,
    objectiveLabel: objective?.label ?? quest.currentObjectiveLabel,
    progressLabel: formatTrackerProgressLabel(quest, objective, runtimeState),
    progressPercent: quest.progressPercent,
    isTracked
  };
}

function selectTrackerObjective(
  objectives: readonly ObjectiveViewModel[],
  runtimeState: QuestRuntimeState | undefined
): ObjectiveViewModel | undefined {
  if (objectives.length === 0) {
    return undefined;
  }

  if (!runtimeState) {
    return objectives[0];
  }

  return (
    objectives.find((objective) => runtimeState.objectives[objective.id]?.completed === false) ??
    objectives[0]
  );
}

function formatTrackerProgressLabel(
  quest: QuestViewModel,
  objective: ObjectiveViewModel | undefined,
  runtimeState: QuestRuntimeState | undefined
): string {
  if (!objective || !runtimeState) {
    return quest.progressText;
  }

  const progress = runtimeState.objectives[objective.id];

  if (!progress) {
    return objective.progressText ?? quest.progressText;
  }

  switch (objective.type) {
    case "activity_duration":
      return `${formatQuestNumber(progress.current)} / ${formatQuestNumber(progress.target)} min`;
    case "composite":
      return `${formatQuestNumber(progress.current)} / ${formatQuestNumber(progress.target)} objectives`;
    case "attribute_reached":
    case "item_collected":
    case "kill":
      return `${formatQuestNumber(progress.current)} / ${formatQuestNumber(progress.target)}`;
  }
}

function compareTrackedQuestPriority(
  left: QuestViewModel,
  right: QuestViewModel,
  trackedQuestIds: ReadonlySet<string>
): number {
  const leftRank = trackedQuestIds.has(left.id) ? 0 : 1;
  const rightRank = trackedQuestIds.has(right.id) ? 0 : 1;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.title.localeCompare(right.title);
}
