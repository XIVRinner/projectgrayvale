import type { QuestViewModel } from "./quest-view-model";

export interface QuestLogFilters {
  readonly search: string;
  readonly status: "all" | "inactive" | "active" | "completed";
  readonly rewardType:
    | "all"
    | "attribute_unlock"
    | "activity_availability"
    | "skill_unlock";
  readonly objectiveType:
    | "all"
    | "attribute_reached"
    | "item_collected"
    | "activity_duration"
    | "kill"
    | "composite";
  readonly sort: "active_first" | "completed_last" | "title_asc" | "progress_desc";
}

export interface QuestLogFilterOption<TValue extends string> {
  readonly label: string;
  readonly value: TValue;
}

export const DEFAULT_QUEST_LOG_FILTERS: QuestLogFilters = {
  search: "",
  status: "active",
  rewardType: "all",
  objectiveType: "all",
  sort: "active_first"
};

export const QUEST_LOG_STATUS_OPTIONS: readonly QuestLogFilterOption<QuestLogFilters["status"]>[] = [
  { label: "All status", value: "all" },
  { label: "In Progress", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Completed", value: "completed" }
];

export const QUEST_LOG_REWARD_OPTIONS: readonly QuestLogFilterOption<QuestLogFilters["rewardType"]>[] =
  [
    { label: "All rewards", value: "all" },
    { label: "Attribute unlocks", value: "attribute_unlock" },
    { label: "Activity unlocks", value: "activity_availability" },
    { label: "Skill unlocks", value: "skill_unlock" }
  ];

export const QUEST_LOG_OBJECTIVE_OPTIONS: readonly QuestLogFilterOption<QuestLogFilters["objectiveType"]>[] =
  [
    { label: "All objectives", value: "all" },
    { label: "Attribute", value: "attribute_reached" },
    { label: "Item", value: "item_collected" },
    { label: "Activity duration", value: "activity_duration" },
    { label: "Kill", value: "kill" },
    { label: "Composite", value: "composite" }
  ];

export const QUEST_LOG_SORT_OPTIONS: readonly QuestLogFilterOption<QuestLogFilters["sort"]>[] = [
  { label: "Active first", value: "active_first" },
  { label: "Completed last", value: "completed_last" },
  { label: "Title A-Z", value: "title_asc" },
  { label: "Progress", value: "progress_desc" }
];

export function applyQuestLogFilters(
  quests: readonly QuestViewModel[],
  filters: QuestLogFilters
): readonly QuestViewModel[] {
  const searchTerm = normalizeSearch(filters.search);

  return [...quests]
    .filter((quest) => matchesStatusFilter(quest, filters.status))
    .filter((quest) => matchesRewardFilter(quest, filters.rewardType))
    .filter((quest) => matchesObjectiveFilter(quest, filters.objectiveType))
    .filter((quest) => searchTerm.length === 0 || quest.searchText.includes(searchTerm))
    .sort((left, right) => compareQuestViewModels(left, right, filters.sort));
}

function matchesStatusFilter(
  quest: QuestViewModel,
  status: QuestLogFilters["status"]
): boolean {
  return status === "all" ? true : quest.status === status;
}

function matchesRewardFilter(
  quest: QuestViewModel,
  rewardType: QuestLogFilters["rewardType"]
): boolean {
  return rewardType === "all"
    ? true
    : quest.allRewards.some((reward) => reward.type === rewardType);
}

function matchesObjectiveFilter(
  quest: QuestViewModel,
  objectiveType: QuestLogFilters["objectiveType"]
): boolean {
  return objectiveType === "all"
    ? true
    : quest.allObjectives.some((objective) => objective.type === objectiveType);
}

function compareQuestViewModels(
  left: QuestViewModel,
  right: QuestViewModel,
  sort: QuestLogFilters["sort"]
): number {
  switch (sort) {
    case "active_first":
      return (
        compareByStatusRank(left, right, {
          active: 0,
          inactive: 1,
          completed: 2
        }) ?? compareByTitle(left, right)
      );
    case "completed_last":
      return (
        compareByStatusRank(left, right, {
          active: 0,
          inactive: 1,
          completed: 2
        }) ?? compareByProgress(right, left) ?? compareByTitle(left, right)
      );
    case "progress_desc":
      return compareByProgress(right, left) ?? compareByTitle(left, right);
    case "title_asc":
      return compareByTitle(left, right);
  }
}

function compareByStatusRank(
  left: QuestViewModel,
  right: QuestViewModel,
  rank: Record<QuestViewModel["status"], number>
): number | null {
  const difference = rank[left.status] - rank[right.status];
  return difference === 0 ? null : difference;
}

function compareByProgress(left: QuestViewModel, right: QuestViewModel): number | null {
  const difference = left.progressPercent - right.progressPercent;
  return difference === 0 ? null : difference;
}

function compareByTitle(left: QuestViewModel, right: QuestViewModel): number {
  return left.title.localeCompare(right.title);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}
