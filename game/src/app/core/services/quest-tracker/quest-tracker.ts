import { Injectable, inject } from "@angular/core";
import type {
  ActivityObjective,
  AttributeObjective,
  CompositeObjective,
  Delta,
  ItemObjective,
  KillObjective,
  Quest,
  QuestObjective
} from "@rinner/grayvale-core";
import { Observable, Subject } from "rxjs";

import { CharacterRosterService } from "../character-roster.service";
import { applyActivityObjectiveDelta } from "./evaluators/activity";
import { applyAttributeObjectiveDelta } from "./evaluators/attribute";
import { applyItemObjectiveDelta } from "./evaluators/item";
import { applyKillObjectiveDelta } from "./evaluators/kill";

export type ObjectiveProgress = {
  current: number;
  target: number;
  completed: boolean;
};

export type QuestRuntimeState = {
  questId: string;
  objectives: Record<string, ObjectiveProgress>;
  completed: boolean;
};

type ObjectiveReference<TObjective extends QuestObjective = QuestObjective> = {
  questId: string;
  objectiveId: string;
  objective: TObjective;
};

type ObjectiveNode = {
  id: string;
  objective: QuestObjective;
  childIds: string[];
};

type IndexedQuestState = {
  questId: string;
  roots: string[];
  nodes: Record<string, ObjectiveNode>;
  state: QuestRuntimeState;
  completionEmitted: boolean;
};

type ObjectiveIndex = {
  attributes: Map<string, ObjectiveReference<AttributeObjective>[]>;
  items: Map<string, ObjectiveReference<ItemObjective>[]>;
  activities: Map<string, ObjectiveReference<ActivityObjective>[]>;
  kills: Map<string, ObjectiveReference<KillObjective>[]>;
};

@Injectable({ providedIn: "root" })
export class QuestTracker {
  private readonly roster = inject(CharacterRosterService);
  private readonly questsById = new Map<string, IndexedQuestState>();
  private readonly questProgressSubject = new Subject<QuestRuntimeState>();
  private readonly questCompletedSubject = new Subject<string>();

  private index: ObjectiveIndex = createEmptyIndex();

  readonly questProgress$: Observable<QuestRuntimeState> =
    this.questProgressSubject.asObservable();
  readonly questCompleted$: Observable<string> =
    this.questCompletedSubject.asObservable();

  constructor() {
    this.roster.deltaApplied$.subscribe((delta) => {
      this.processDelta(delta);
    });
  }

  loadActiveQuests(quests: Quest[]): void {
    this.index = createEmptyIndex();
    this.questsById.clear();

    quests.forEach((quest) => {
      const indexedQuest = buildIndexedQuestState(quest);

      this.questsById.set(quest.id, indexedQuest);
      registerIndexedQuest(this.index, indexedQuest);
      reevaluateQuest(indexedQuest);
    });
  }

  processDelta(delta: Delta): void {
    const impactedReferences = this.lookupObjectiveReferences(delta);

    if (impactedReferences.length === 0) {
      return;
    }

    const impactedQuestIds = new Set<string>();

    impactedReferences.forEach((reference) => {
      const questState = this.questsById.get(reference.questId);

      if (!questState) {
        return;
      }

      const currentProgress = questState.state.objectives[reference.objectiveId];

      if (!currentProgress) {
        return;
      }

      const nextProgress = applyObjectiveDelta(reference.objective, currentProgress, delta);

      if (!nextProgress || isSameProgress(currentProgress, nextProgress)) {
        return;
      }

      questState.state.objectives[reference.objectiveId] = nextProgress;
      impactedQuestIds.add(reference.questId);
    });

    impactedQuestIds.forEach((questId) => {
      const questState = this.questsById.get(questId);

      if (!questState) {
        return;
      }

      const wasCompleted = questState.state.completed;

      reevaluateQuest(questState);
      this.questProgressSubject.next(cloneQuestRuntimeState(questState.state));

      if (!wasCompleted && questState.state.completed && !questState.completionEmitted) {
        questState.completionEmitted = true;
        this.questCompletedSubject.next(questId);
      }
    });
  }

  getState(): QuestRuntimeState[] {
    return [...this.questsById.values()].map((quest) => cloneQuestRuntimeState(quest.state));
  }

  private lookupObjectiveReferences(delta: Delta): ObjectiveReference[] {
    const references = new Map<string, ObjectiveReference>();

    collectReferences(
      references,
      this.index.attributes,
      tryGetIndexedPath(delta, ["attributes"], 2)
    );
    collectReferences(
      references,
      this.index.items,
      tryGetIndexedPath(delta, ["inventory", "items"], 3)
    );
    collectReferences(references, this.index.activities, getActivityIndexKey(delta));
    collectReferences(references, this.index.kills, getKillIndexKey(delta));

    return [...references.values()];
  }
}

function buildIndexedQuestState(quest: Quest): IndexedQuestState {
  const nodes: Record<string, ObjectiveNode> = {};
  const objectives: Record<string, ObjectiveProgress> = {};
  const roots = quest.objectives.map((objective, index) =>
    registerObjectiveNode(objective, `${quest.id}:${index}`, nodes, objectives)
  );

  return {
    questId: quest.id,
    roots,
    nodes,
    state: {
      questId: quest.id,
      objectives,
      completed: false
    },
    completionEmitted: false
  };
}

function registerObjectiveNode(
  objective: QuestObjective,
  objectiveId: string,
  nodes: Record<string, ObjectiveNode>,
  objectives: Record<string, ObjectiveProgress>
): string {
  const childIds =
    objective.type === "composite"
      ? objective.objectives.map((entry, index) =>
          registerObjectiveNode(entry, `${objectiveId}.${index}`, nodes, objectives)
        )
      : [];

  nodes[objectiveId] = {
    id: objectiveId,
    objective,
    childIds
  };
  objectives[objectiveId] = createInitialProgress(objective, childIds.length);

  return objectiveId;
}

function createInitialProgress(
  objective: QuestObjective,
  childCount: number
): ObjectiveProgress {
  switch (objective.type) {
    case "attribute_reached":
      return { current: 0, target: objective.target, completed: false };
    case "item_collected":
      return { current: 0, target: objective.quantity, completed: false };
    case "activity_duration":
      return { current: 0, target: objective.duration, completed: false };
    case "kill":
      return { current: 0, target: objective.count, completed: false };
    case "composite":
      return {
        current: 0,
        target: objective.operator === "AND" ? childCount : Math.min(childCount, 1),
        completed: false
      };
  }
}

function registerIndexedQuest(index: ObjectiveIndex, quest: IndexedQuestState): void {
  Object.values(quest.nodes).forEach((node) => {
    switch (node.objective.type) {
      case "attribute_reached":
        pushIndexEntry(index.attributes, node.objective.attribute, {
          questId: quest.questId,
          objectiveId: node.id,
          objective: node.objective
        });
        return;
      case "item_collected":
        pushIndexEntry(index.items, node.objective.itemId, {
          questId: quest.questId,
          objectiveId: node.id,
          objective: node.objective
        });
        return;
      case "activity_duration":
        pushIndexEntry(index.activities, node.objective.activityId, {
          questId: quest.questId,
          objectiveId: node.id,
          objective: node.objective
        });
        return;
      case "kill":
        pushIndexEntry(index.kills, node.objective.target, {
          questId: quest.questId,
          objectiveId: node.id,
          objective: node.objective
        });
        return;
      case "composite":
        return;
    }
  });
}

function reevaluateQuest(quest: IndexedQuestState): void {
  quest.roots.forEach((objectiveId) => {
    evaluateObjectiveNode(objectiveId, quest.nodes, quest.state.objectives);
  });

  quest.state.completed = quest.roots.every(
    (objectiveId) => quest.state.objectives[objectiveId]?.completed ?? false
  );
}

function evaluateObjectiveNode(
  objectiveId: string,
  nodes: Record<string, ObjectiveNode>,
  progressById: Record<string, ObjectiveProgress>
): ObjectiveProgress {
  const node = nodes[objectiveId];
  const existingProgress = progressById[objectiveId];

  if (!node || !existingProgress) {
    throw new Error(`Unknown objective node "${objectiveId}".`);
  }

  if (node.objective.type !== "composite") {
    return existingProgress;
  }

  const childProgresses = node.childIds.map((childId) =>
    evaluateObjectiveNode(childId, nodes, progressById)
  );
  const nextProgress = evaluateComposite(node.objective, childProgresses);

  progressById[objectiveId] = nextProgress;
  return nextProgress;
}

export function evaluateComposite(
  objective: CompositeObjective,
  childProgresses: readonly ObjectiveProgress[]
): ObjectiveProgress {
  if (objective.operator === "AND") {
    const current = childProgresses.filter((child) => child.completed).length;
    const target = childProgresses.length;

    return {
      current,
      target,
      completed: current >= target
    };
  }

  const completedCount = childProgresses.filter((child) => child.completed).length;

  return {
    current: completedCount > 0 ? 1 : 0,
    target: childProgresses.length === 0 ? 0 : 1,
    completed: completedCount > 0
  };
}

function applyObjectiveDelta(
  objective: QuestObjective,
  progress: ObjectiveProgress,
  delta: Delta
): ObjectiveProgress | null {
  switch (objective.type) {
    case "attribute_reached":
      return applyAttributeObjectiveDelta(objective, progress, delta);
    case "item_collected":
      return applyItemObjectiveDelta(objective, progress, delta);
    case "activity_duration":
      return applyActivityObjectiveDelta(objective, progress, delta);
    case "kill":
      return applyKillObjectiveDelta(objective, progress, delta);
    case "composite":
      return null;
  }
}

function createEmptyIndex(): ObjectiveIndex {
  return {
    attributes: new Map(),
    items: new Map(),
    activities: new Map(),
    kills: new Map()
  };
}

function pushIndexEntry<TKey, TValue>(
  map: Map<TKey, TValue[]>,
  key: TKey,
  value: TValue
): void {
  const existing = map.get(key);

  if (existing) {
    existing.push(value);
    return;
  }

  map.set(key, [value]);
}

function collectReferences<TObjective extends QuestObjective>(
  references: Map<string, ObjectiveReference>,
  index: Map<string, ObjectiveReference<TObjective>[]>,
  key: string | null
): void {
  if (!key) {
    return;
  }

  for (const reference of index.get(key) ?? []) {
    references.set(`${reference.questId}:${reference.objectiveId}`, reference);
  }
}

function tryGetIndexedPath(
  delta: Delta,
  prefix: readonly string[],
  exactLength: number
): string | null {
  if (
    delta.target !== "player" ||
    delta.path.length !== exactLength ||
    prefix.some((segment, index) => delta.path[index] !== segment)
  ) {
    return null;
  }

  return delta.path[exactLength - 1] ?? null;
}

function getActivityIndexKey(delta: Delta): string | null {
  const nestedSignal = delta.meta?.["questSignal"];

  if (typeof nestedSignal === "object" && nestedSignal !== null && !Array.isArray(nestedSignal)) {
    const record = nestedSignal as Record<string, unknown>;

    if (record["type"] === "activity_duration" && typeof record["activityId"] === "string") {
      return record["activityId"];
    }
  }

  const activityTick = delta.meta?.["activityTick"];

  if (typeof activityTick === "object" && activityTick !== null && !Array.isArray(activityTick)) {
    const record = activityTick as Record<string, unknown>;

    if (typeof record["activityId"] === "string") {
      return record["activityId"];
    }
  }

  return typeof delta.meta?.["activityId"] === "string" ? delta.meta["activityId"] : null;
}

function getKillIndexKey(delta: Delta): string | null {
  const nestedSignal = delta.meta?.["questSignal"];

  if (typeof nestedSignal === "object" && nestedSignal !== null && !Array.isArray(nestedSignal)) {
    const record = nestedSignal as Record<string, unknown>;

    if (record["type"] === "kill" && typeof record["target"] === "string") {
      return record["target"];
    }
  }

  return typeof delta.meta?.["killTarget"] === "string" ? delta.meta["killTarget"] : null;
}

function isSameProgress(left: ObjectiveProgress, right: ObjectiveProgress): boolean {
  return (
    left.current === right.current &&
    left.target === right.target &&
    left.completed === right.completed
  );
}

function cloneQuestRuntimeState(state: QuestRuntimeState): QuestRuntimeState {
  return {
    questId: state.questId,
    objectives: Object.fromEntries(
      Object.entries(state.objectives).map(([objectiveId, progress]) => [
        objectiveId,
        { ...progress }
      ])
    ),
    completed: state.completed
  };
}
