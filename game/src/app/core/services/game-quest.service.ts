import { effect, Injectable, inject, signal } from "@angular/core";
import {
  type ActivityReward,
  type Delta,
  type PlayerQuestEntry,
  type Player,
  type Quest,
  type QuestLog,
  type QuestObjective,
  type QuestStep,
  type QuestReward
} from "@rinner/grayvale-core";
import { Subject, type Subscription } from "rxjs";

import { ActivitiesLoader } from "../../data/loaders/activities.loader";
import { QuestsLoader } from "../../data/loaders/quests.loader";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
import type { GameQuestEvent } from "./game-quest.types";
import {
  QuestTracker,
  type QuestRuntimeState,
  type TrackedQuestStep
} from "./quest-tracker/quest-tracker";

const RECOVERY_QUEST_ID = "quest_recovery";
const PROLOGUE_ARC_ID = "prologue";
const PROLOGUE_QUEST_HANDOFF_CHAPTER = 2;
const AUTHORED_QUEST_RETRY_DELAY_MS = 1500;

@Injectable({ providedIn: "root" })
export class GameQuestService {
  private readonly roster = inject(CharacterRosterService);
  private readonly questTracker = inject(QuestTracker);
  private readonly questsLoader = inject(QuestsLoader);
  private readonly activitiesLoader = inject(ActivitiesLoader);
  private readonly debugLog = inject(DebugLogService);

  private readonly authoredQuestsState = signal<readonly Quest[]>([]);
  private readonly activitiesState = signal<readonly GameActivityDefinition[]>([]);
  private readonly runtimeStatesState = signal<readonly QuestRuntimeState[]>([]);
  private readonly latestQuestMessageState = signal<string | null>(null);
  private readonly latestAttributeMessageState = signal<string | null>(null);
  private readonly eventSubject = new Subject<GameQuestEvent>();

  private lastSyncKey: string | null = null;
  private readonly pendingQuestStartIds = new Set<string>();
  private questsLoadSubscription: Subscription | null = null;
  private questsLoadRetryHandle: ReturnType<typeof setTimeout> | null = null;
  private questsLoadAttempt = 0;

  readonly authoredQuests = this.authoredQuestsState.asReadonly();
  readonly runtimeStates = this.runtimeStatesState.asReadonly();
  readonly latestQuestMessage = this.latestQuestMessageState.asReadonly();
  readonly latestAttributeMessage = this.latestAttributeMessageState.asReadonly();
  readonly events$ = this.eventSubject.asObservable();

  constructor() {
    this.ensureAuthoredQuestsLoaded();

    this.activitiesLoader.load().subscribe({
      next: (activities) => {
        this.debugLog.logMessage("quest", "Loaded quest-related activities.", {
          activityCount: activities.length
        });
        this.activitiesState.set(activities);
      },
      error: () => {
        this.debugLog.logMessage("quest", "Failed to load quest-related activities.");
        this.activitiesState.set([]);
      }
    });

    this.questTracker.questProgress$.subscribe((state) => {
      this.runtimeStatesState.set(
        this.mergeRuntimeStatesWithManual(this.questTracker.getState())
      );

      const summary = this.describeQuestProgress(state);

      if (summary) {
        this.debugLog.logMessage("quest", "Quest progress updated.", {
          questId: state.questId,
          summary
        });
        this.eventSubject.next({
          type: "quest-progressed",
          questId: state.questId,
          message: summary
        });
      }
    });

    this.questTracker.questCompleted$.subscribe((questId) => {
      this.handleTrackedStepCompleted(questId);
    });

    this.roster.deltaApplied$.subscribe((delta) => {
      this.handleAttributeDeltaMessage(delta);
    });

    effect(() => {
      this.roster.activeSlotId();
      this.roster.activeCharacter();
      this.authoredQuestsState();

      if (this.authoredQuestsState().length === 0 && this.pendingQuestStartIds.size > 0) {
        this.ensureAuthoredQuestsLoaded();
      }

      this.flushPendingQuestStarts();
      this.syncQuestState();
    });
  }

  private reconcileScriptedQuestState(): boolean {
    const player = this.roster.activeCharacter();
    const recoveryQuest = this.authoredQuestsState().find((quest) => quest.id === RECOVERY_QUEST_ID);

    if (!player || !recoveryQuest) {
      return false;
    }

    if (
      player.story?.currentArcId !== PROLOGUE_ARC_ID ||
      player.story.currentChapter < PROLOGUE_QUEST_HANDOFF_CHAPTER
    ) {
      return false;
    }

    const existingEntry = player.questLog?.quests[RECOVERY_QUEST_ID];

    if (existingEntry?.status === "active" || existingEntry?.status === "completed") {
      return false;
    }

    this.debugLog.logMessage("quest", "Reconciling missing scripted recovery quest for post-prologue save.", {
      story: player.story,
      vitality: player.attributes["vitality"] ?? null
    });
    return this.startQuestInternal(recoveryQuest);
  }

  startQuestById(questId: string): boolean {
    const player = this.roster.activeCharacter();
    const authoredQuests = this.authoredQuestsState();
    const quest = authoredQuests.find((entry) => entry.id === questId);
    const authoredDataLoaded = authoredQuests.length > 0;

    this.debugLog.logMessage("quest", "Quest start requested.", {
      questId,
      hasActivePlayer: player !== null,
      authoredQuestLoaded: quest !== undefined,
      authoredDataLoaded
    });

    if (!player) {
      this.debugLog.logMessage("quest", "Quest start rejected because there is no active player.", {
        questId
      });
      return false;
    }

    if (!quest && authoredDataLoaded) {
      this.debugLog.logMessage("quest", "Quest start rejected because the quest was not found in authored data.", {
        questId
      });
      return false;
    }

    if (!quest) {
      const wasPending = this.pendingQuestStartIds.has(questId);

      this.pendingQuestStartIds.add(questId);

      if (!wasPending) {
        this.ensureAuthoredQuestsLoaded(true);
      }

      if (!wasPending) {
        this.debugLog.logMessage("quest", "Quest start queued until authored quest data is available.", {
          questId
        });
        this.eventSubject.next({
          type: "quest-start-queued",
          questId,
          message: `Queued quest start: ${prettyLabel(questId)}.`
        });
      }

      return true;
    }

    return this.startQuestInternal(quest);
  }

  resolveQuestStep(questId: string, stepId: string): boolean {
    const player = this.roster.activeCharacter();
    const quest = this.authoredQuestsState().find((entry) => entry.id === questId);
    const entry = player?.questLog?.quests[questId];

    this.debugLog.logMessage("quest", "Manual quest step resolution requested.", {
      questId,
      stepId,
      hasPlayer: player !== null,
      hasQuest: quest !== undefined,
      currentStep: entry?.currentStep ?? null,
      status: entry?.status ?? null
    });

    if (!player || !quest || !entry || entry.status !== "active") {
      return false;
    }

    if (entry.currentStep !== stepId) {
      return false;
    }

    const step = getQuestStepByIdLocal(quest, stepId);

    if (!step || resolveStepCompletionMode(step) !== "manual") {
      return false;
    }

    return this.advanceQuestStep(quest, entry, step);
  }

  private ensureAuthoredQuestsLoaded(forceReload = false): void {
    if (!forceReload && this.authoredQuestsState().length > 0) {
      return;
    }

    if (this.questsLoadSubscription) {
      return;
    }

    if (this.questsLoadRetryHandle !== null) {
      clearTimeout(this.questsLoadRetryHandle);
      this.questsLoadRetryHandle = null;
    }

    this.questsLoadAttempt += 1;
    const attempt = this.questsLoadAttempt;

    this.debugLog.logMessage("quest", "Loading authored quests.", {
      attempt,
      forceReload
    });

    this.questsLoadSubscription = this.questsLoader.load().subscribe({
      next: (quests) => {
        this.questsLoadSubscription = null;
        this.questsLoadAttempt = 0;
        this.debugLog.logMessage("quest", "Loaded authored quests.", {
          questCount: quests.length,
          attempt
        });
        this.authoredQuestsState.set(quests);
        this.flushPendingQuestStarts();
        this.syncQuestState(true);
      },
      error: (error: unknown) => {
        this.questsLoadSubscription = null;
        this.debugLog.logMessage("quest", "Failed to load authored quests.", {
          attempt,
          error: toErrorMessage(error, "Unknown authored quest load error."),
          retryInMs: AUTHORED_QUEST_RETRY_DELAY_MS
        });
        this.authoredQuestsState.set([]);
        this.refreshActiveQuests();
        this.scheduleAuthoredQuestReload();
      }
    });
  }

  private syncQuestState(forceRefresh = false): void {
    if (this.reconcileScriptedQuestState()) {
      return;
    }

    const syncKey = buildQuestSyncKey(
      this.roster.activeSlotId(),
      this.roster.activeCharacter()?.questLog,
      this.authoredQuestsState()
    );

    if (!forceRefresh && syncKey === this.lastSyncKey) {
      return;
    }

    this.refreshActiveQuests();
  }

  private scheduleAuthoredQuestReload(): void {
    if (this.questsLoadRetryHandle !== null) {
      return;
    }

    this.questsLoadRetryHandle = setTimeout(() => {
      this.questsLoadRetryHandle = null;
      this.ensureAuthoredQuestsLoaded(true);
    }, AUTHORED_QUEST_RETRY_DELAY_MS);
  }

  private startQuestInternal(quest: Quest): boolean {
    const player = this.roster.activeCharacter();
    const firstStep = getQuestStepsLocal(quest)[0];

    if (!player || !firstStep) {
      this.debugLog.logMessage("quest", "Quest start failed because there is no active player.", {
        questId: quest.id
      });
      return false;
    }

    const existingEntry = player.questLog?.quests[quest.id];

    if (existingEntry?.status === "active" || existingEntry?.status === "completed") {
      this.debugLog.logMessage("quest", "Quest start skipped because the quest already exists.", {
        questId: quest.id,
        status: existingEntry.status
      });
      return false;
    }

    const deltas: Delta[] = [
      {
        type: "set",
        target: "player",
        path: ["questLog", "quests", quest.id],
        value: {
          currentStep: firstStep.id,
          status: "active",
          completedSteps: []
        },
        meta: {
          gameplayLogHandledBy: "quest-event"
        }
      }
    ];

    deltas.push(...buildQuestRewardDeltas(quest.startRewards));

    const updatedSlot = this.roster.applyActiveCharacterDeltas(deltas);

    if (!updatedSlot) {
      this.debugLog.logMessage("quest", "Quest start failed because quest deltas could not be applied.", {
        questId: quest.id
      });
      return false;
    }

    this.pendingQuestStartIds.delete(quest.id);
    applyQuestRewards(this.roster, quest.startRewards);
    const message = `Quest received: ${describeQuestInstruction(quest, firstStep.id)}.`;

    this.latestQuestMessageState.set(message);
    this.debugLog.logMessage("quest", "Quest started.", {
      questId: quest.id,
      message
    });
    this.eventSubject.next({
      type: "quest-started",
      questId: quest.id,
      message
    });
    this.refreshActiveQuests();
    return true;
  }

  executeActivityById(activityId: string): boolean {
    const player = this.roster.activeCharacter();
    const activity = this.activitiesState().find((entry) => entry.id === activityId);

    this.debugLog.logMessage("quest", "Quest activity requested.", {
      activityId,
      hasActivePlayer: player !== null,
      activityLoaded: activity !== undefined
    });

    if (!player || !activity) {
      this.debugLog.logMessage("quest", "Quest activity rejected because the player or activity was unavailable.", {
        activityId
      });
      return false;
    }

    const availability = player.activityState?.availability?.[activityId];

    if (!availability || availability.status !== "enabled") {
      this.debugLog.logMessage("quest", "Quest activity rejected because it is not enabled.", {
        activityId,
        availability
      });
      return false;
    }

    const deltas = buildActivityRewardDeltas(activity, player);

    if (deltas.length === 0) {
      this.debugLog.logMessage("quest", "Quest activity produced no reward deltas.", {
        activityId
      });
      return false;
    }

    const applied = this.roster.applyActiveCharacterDeltas(deltas) !== null;

    this.debugLog.logMessage("quest", applied ? "Quest activity applied reward deltas." : "Quest activity failed while applying reward deltas.", {
      activityId,
      deltaCount: deltas.length
    });

    return applied;
  }

  /**
   * Applies one tick of reward deltas for an ongoing activity.
   * Unlike `executeActivityById`, this does not fail when there are no reward
   * deltas — activities without rewards still produce a valid tick.
   *
   * Returns the deltas that were applied (empty when the activity has no
   * reward definitions or when it is unavailable for any reason).
   */
  executeActivityTick(activityId: string): readonly Delta[] {
    const player = this.roster.activeCharacter();
    const activity = this.activitiesState().find((entry) => entry.id === activityId);

    if (!player || !activity) {
      return [];
    }

    const availability = player.activityState?.availability?.[activityId];

    if (!availability || availability.status !== "enabled") {
      this.debugLog.logMessage("quest", "Activity tick skipped — not enabled.", {
        activityId,
        status: availability?.status ?? "missing"
      });
      return [];
    }

    const deltas = buildActivityRewardDeltas(activity, player);

    if (deltas.length > 0) {
      this.roster.applyActiveCharacterDeltas(deltas);
      this.debugLog.logMessage("quest", "Activity tick applied reward deltas.", {
        activityId,
        deltaCount: deltas.length
      });
    }

    return deltas;
  }

  private refreshActiveQuests(): void {
    const player = this.roster.activeCharacter();
    const authoredQuests = this.authoredQuestsState();

    this.lastSyncKey = buildQuestSyncKey(
      this.roster.activeSlotId(),
      player?.questLog,
      authoredQuests
    );

    if (!player || authoredQuests.length === 0) {
      this.debugLog.logMessage("quest", "Clearing active quest tracker state.", {
        hasPlayer: player !== null,
        authoredQuestCount: authoredQuests.length
      });
      this.questTracker.loadActiveQuests([]);
      this.runtimeStatesState.set([]);
      return;
    }

    const activeQuestIds = Object.entries(player.questLog?.quests ?? {})
      .filter(([, entry]) => entry.status === "active")
      .map(([questId]) => questId);
    const activeQuests = authoredQuests.filter((quest) => activeQuestIds.includes(quest.id));
    const { trackedSteps, manualStates } = collectActiveQuestStepStates(activeQuests, player.questLog);

    this.debugLog.logMessage("quest", "Refreshing active quest tracker state.", {
      activeQuestIds,
      trackedStepCount: trackedSteps.length,
      manualStepCount: manualStates.length
    });
    this.questTracker.loadActiveQuests(trackedSteps);
    seedTrackerFromPlayer(this.questTracker, player, trackedSteps);
    this.runtimeStatesState.set(this.mergeRuntimeStatesWithManual(this.questTracker.getState()));
  }

  private handleTrackedStepCompleted(questId: string): void {
    const activePlayer = this.roster.activeCharacter();
    const quest = this.authoredQuestsState().find((entry) => entry.id === questId);
    const questEntry = activePlayer?.questLog?.quests[questId];

    if (!activePlayer || !quest || !questEntry) {
      this.debugLog.logMessage("quest", "Quest completion ignored because the player or quest definition was missing.", {
        questId
      });
      return;
    }

    if (questEntry.status !== "active") {
      return;
    }

    const step = getQuestStepByIdLocal(quest, questEntry.currentStep);

    if (!step) {
      return;
    }

    this.advanceQuestStep(quest, questEntry, step);
  }

  private advanceQuestStep(
    quest: Quest,
    entry: PlayerQuestEntry,
    step: QuestStep
  ): boolean {
    const steps = getQuestStepsLocal(quest);
    const stepIndex = steps.findIndex((candidate) => candidate.id === step.id);

    if (stepIndex < 0) {
      return false;
    }

    const completedSteps = [...new Set([...(entry.completedSteps ?? []), step.id])];
    const nextStep = steps[stepIndex + 1];
    const deltas: Delta[] = [];

    deltas.push({
      type: "set",
      target: "player",
      path: ["questLog", "quests", quest.id],
      value: nextStep
        ? {
            currentStep: nextStep.id,
            status: "active",
            completedSteps
          }
        : {
            currentStep: step.id,
            status: "completed",
            completedSteps
          },
      meta: {
        gameplayLogHandledBy: "quest-event"
      }
    });

    deltas.push(...buildQuestRewardDeltas(step.rewards));

    if (!nextStep) {
      deltas.push(...buildQuestRewardDeltas(quest.rewards));
    }

    const applied = this.roster.applyActiveCharacterDeltas(deltas);

    if (!applied) {
      return false;
    }

    applyQuestRewards(this.roster, step.rewards);

    if (nextStep) {
      const message = `Quest updated: ${describeQuestInstruction(quest, nextStep.id)}.`;

      this.latestQuestMessageState.set(message);
      this.debugLog.logMessage("quest", "Quest advanced to the next step.", {
        questId: quest.id,
        completedStepId: step.id,
        nextStepId: nextStep.id,
        message
      });
      this.eventSubject.next({
        type: "quest-progressed",
        questId: quest.id,
        message
      });
      this.refreshActiveQuests();
      return true;
    }

    applyQuestRewards(this.roster, quest.rewards);
    const message =
      `Quest complete: ${describeQuestInstruction(quest, step.id)}${describeQuestRewards([
        ...(step.rewards ?? []),
        ...(quest.rewards ?? [])
      ])}.`;

    this.latestQuestMessageState.set(message);
    this.debugLog.logMessage("quest", "Quest completed.", {
      questId: quest.id,
      completedStepId: step.id,
      message
    });
    this.eventSubject.next({
      type: "quest-completed",
      questId: quest.id,
      message
    });
    this.refreshActiveQuests();
    return true;
  }

  private mergeRuntimeStatesWithManual(
    trackedStates: readonly QuestRuntimeState[]
  ): readonly QuestRuntimeState[] {
    const player = this.roster.activeCharacter();

    if (!player) {
      return trackedStates;
    }

    const activeQuests = this.authoredQuestsState().filter(
      (quest) => player.questLog?.quests[quest.id]?.status === "active"
    );
    const { manualStates } = collectActiveQuestStepStates(activeQuests, player.questLog);

    return [...trackedStates, ...manualStates];
  }

  private handleAttributeDeltaMessage(delta: Delta): void {
    if (
      delta.target !== "player" ||
      delta.path.length !== 2 ||
      delta.path[0] !== "attributes" ||
      typeof delta.value !== "number"
    ) {
      return;
    }

    const attributeId = delta.path[1] ?? "attribute";
    const currentValue = this.roster.activeCharacter()?.attributes[attributeId];

    if (typeof currentValue !== "number") {
      return;
    }

    const prettyName = prettyLabel(attributeId);

    if (delta.type === "add") {
      const prefix = delta.value >= 0 ? "+" : "";

      this.latestAttributeMessageState.set(
        `${prettyName} ${prefix}${formatScore(delta.value)} -> ${formatScore(currentValue)}`
      );
      return;
    }

    this.latestAttributeMessageState.set(
      `${prettyName} is now ${formatScore(currentValue)}`
    );
  }

  private describeQuestProgress(state: QuestRuntimeState): string | null {
    const quest = this.authoredQuestsState().find((entry) => entry.id === state.questId);
    const step = quest ? getQuestStepByIdLocal(quest, state.stepId) : undefined;

    if (!quest || !step || !step.objectives || step.objectives.length === 0) {
      return null;
    }

    const objective = step.objectives[0];
    const progress = state.objectives[`${state.questId}:0`];

    if (!progress) {
      return null;
    }

    if (objective.type === "attribute_reached") {
      return `${prettyLabel(objective.attribute)} ${formatScore(progress.current)} / ${formatScore(progress.target)}`;
    }

    return describeQuestInstruction(quest, state.stepId);
  }

  private flushPendingQuestStarts(): void {
    if (this.pendingQuestStartIds.size === 0) {
      return;
    }

    if (this.authoredQuestsState().length === 0) {
      return;
    }

    if (!this.roster.activeCharacter()) {
      return;
    }

    this.debugLog.logMessage("quest", "Flushing queued quest starts.", {
      pendingQuestIds: [...this.pendingQuestStartIds]
    });

    const questsById = new Map(this.authoredQuestsState().map((quest) => [quest.id, quest]));

    for (const questId of [...this.pendingQuestStartIds]) {
      const quest = questsById.get(questId);

      if (!quest) {
        this.pendingQuestStartIds.delete(questId);
        this.debugLog.logMessage("quest", "Discarded queued quest start because authored quest data has no matching quest.", {
          questId
        });
        continue;
      }

      this.startQuestInternal(quest);
    }
  }
}

function seedTrackerFromPlayer(
  tracker: QuestTracker,
  player: Player,
  quests: readonly TrackedQuestStep[]
): void {
  const seededAttributes = new Set<string>();
  const seededItems = new Set<string>();

  quests.forEach((quest) => {
    seedQuestObjectives(tracker, player, quest.objectives, seededAttributes, seededItems);
  });
}

function collectActiveQuestStepStates(
  quests: readonly Quest[],
  questLog: QuestLog | undefined
): {
  trackedSteps: TrackedQuestStep[];
  manualStates: QuestRuntimeState[];
} {
  const trackedSteps: TrackedQuestStep[] = [];
  const manualStates: QuestRuntimeState[] = [];

  for (const quest of quests) {
    const entry = questLog?.quests[quest.id];

    if (!entry || entry.status !== "active") {
      continue;
    }

    const step = getQuestStepByIdLocal(quest, entry.currentStep);

    if (!step) {
      continue;
    }

    if (resolveStepCompletionMode(step) === "manual") {
      manualStates.push({
        questId: quest.id,
        stepId: step.id,
        objectives: {},
        completed: false
      });
      continue;
    }

    trackedSteps.push({
      questId: quest.id,
      stepId: step.id,
      objectives: step.objectives ?? []
    });
  }

  return { trackedSteps, manualStates };
}

function seedQuestObjectives(
  tracker: QuestTracker,
  player: Player,
  objectives: readonly QuestObjective[],
  seededAttributes: Set<string>,
  seededItems: Set<string>
): void {
  objectives.forEach((objective) => {
    switch (objective.type) {
      case "attribute_reached":
        if (!seededAttributes.has(objective.attribute)) {
          seededAttributes.add(objective.attribute);
          tracker.processDelta({
            type: "set",
            target: "player",
            path: ["attributes", objective.attribute],
            value: player.attributes[objective.attribute] ?? 0
          });
        }
        return;
      case "item_collected":
        if (!seededItems.has(objective.itemId)) {
          seededItems.add(objective.itemId);
          tracker.processDelta({
            type: "set",
            target: "player",
            path: ["inventory", "items", objective.itemId],
            value: player.inventory.items[objective.itemId] ?? 0
          });
        }
        return;
      case "composite":
        seedQuestObjectives(
          tracker,
          player,
          objective.objectives,
          seededAttributes,
          seededItems
        );
        return;
      case "activity_duration":
      case "kill":
        return;
    }
  });
}

function buildActivityRewardDeltas(
  activity: GameActivityDefinition,
  player: Player
): Delta[] {
  const deltas: Delta[] = [];
  let attachedActivityMeta = false;

  for (const reward of activity.rewards ?? []) {
    const resolvedAmount = resolveActivityRewardAmount(reward, player);

    if (resolvedAmount === null || resolvedAmount === 0) {
      continue;
    }

    deltas.push(
      buildActivityRewardDelta(activity, reward, resolvedAmount, !attachedActivityMeta)
    );
    attachedActivityMeta = true;
  }

  return deltas;
}

function buildQuestRewardDeltas(rewards: readonly QuestReward[] | undefined): Delta[] {
  return (rewards ?? []).flatMap((reward) => {
    switch (reward.type) {
      case "activity_availability": {
        const value =
          reward.status === "disabled"
            ? {
                status: reward.status,
                ...(reward.disabledReason ? { disabledReason: reward.disabledReason } : {})
              }
            : { status: reward.status };

        return [
          {
            type: "set",
            target: "player",
            path: ["activityState", "availability", reward.activityId],
            value
          } satisfies Delta
        ];
      }
      case "attribute_unlock":
      case "skill_unlock":
        return [];
    }
  });
}

function applyQuestRewards(
  roster: CharacterRosterService,
  rewards: readonly QuestReward[] | undefined
): void {
  for (const reward of rewards ?? []) {
    switch (reward.type) {
      case "attribute_unlock":
        roster.setActiveAttributeUnlocked(reward.attributeId, reward.unlocked ?? true);
        break;
      case "skill_unlock":
        roster.setActiveSkillUnlocked(reward.skillId, reward.unlocked ?? true);
        break;
      case "activity_availability":
        break;
    }
  }
}

function buildActivityRewardDelta(
  activity: GameActivityDefinition,
  reward: ActivityReward,
  amount: number,
  attachActivityMeta: boolean
): Delta {
  if (typeof reward.targetId !== "string" || reward.targetId.trim().length === 0) {
    throw new Error("Activity reward is missing a targetId.");
  }

  const meta = attachActivityMeta
    ? {
        activityTick: {
          activityId: activity.id,
          difficulty: activity.difficulty,
          governingAttributes: activity.governingAttributes,
          tags: activity.tags,
          tickDelta: 1,
          duration: 1
        },
        ...(activity.questSignal ? { questSignal: activity.questSignal } : {})
      }
    : undefined;

  switch (reward.type) {
    case "attribute":
      return {
        type: "add",
        target: "player",
        path: ["attributes", reward.targetId],
        value: amount,
        meta
      };
    case "skill":
      return {
        type: "add",
        target: "player",
        path: ["skills", reward.targetId],
        value: amount,
        meta
      };
    case "item":
      return {
        type: "add",
        target: "player",
        path: ["inventory", "items", reward.targetId],
        value: normalizeInventoryRewardAmount(amount),
        meta
      };
    case "currency":
      throw new Error(
        `Activity "${activity.id}" uses currency rewards, but player inventory currencies are not implemented yet.`
      );
  }
}

function resolveActivityRewardAmount(
  reward: ActivityReward,
  player: Player
): number | null {
  if (!shouldApplyActivityReward(reward)) {
    return null;
  }

  switch (reward.value.type) {
    case "flat":
      return reward.value.amount;
    case "range":
      return resolveRangeRewardAmount(reward.value.min, reward.value.max);
    case "scaled":
      return reward.value.base + readRewardScalingSource(player, reward.value.scaling);
  }
}

function shouldApplyActivityReward(reward: ActivityReward): boolean {
  if (!reward.distribution || reward.distribution.type === "deterministic") {
    return true;
  }

  const chance = reward.distribution.chance ?? 1;
  return Math.random() <= chance;
}

function resolveRangeRewardAmount(min: number, max: number): number {
  const roll = Math.random();

  if (Number.isInteger(min) && Number.isInteger(max)) {
    const span = max - min + 1;
    return min + Math.floor(roll * span);
  }

  return min + (max - min) * roll;
}

function readRewardScalingSource(
  player: Player,
  scaling: {
    source: "skill" | "attribute";
    id: string;
    factor: number;
  }
): number {
  if (scaling.source === "attribute") {
    return (player.attributes[scaling.id] ?? 0) * scaling.factor;
  }

  return (player.skills[scaling.id] ?? 0) * scaling.factor;
}

function normalizeInventoryRewardAmount(amount: number): number {
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return 1;
  }

  return roundedAmount;
}

function describeQuestInstruction(quest: Quest, stepId?: string): string {
  const resolvedStep =
    stepId !== undefined ? getQuestStepByIdLocal(quest, stepId) : getQuestStepsLocal(quest)[0];
  const objective = resolvedStep?.objectives?.[0] ?? quest.objectives?.[0];

  if (resolvedStep?.label) {
    return resolvedStep.label;
  }

  if (!objective) {
    return prettyLabel(quest.id);
  }

  if (objective.type === "attribute_reached") {
    return `reach ${formatScore(objective.target)} ${prettyLabel(objective.attribute)}`;
  }

  return prettyLabel(quest.id);
}

function describeQuestRewards(rewards: readonly QuestReward[] | undefined): string {
  if (!rewards || rewards.length === 0) {
    return "";
  }

  const labels = rewards.map((reward) => {
    switch (reward.type) {
      case "attribute_unlock":
        return `${prettyLabel(reward.attributeId)} unlocked`;
      case "skill_unlock":
        return `${prettyLabel(reward.skillId)} unlocked`;
      case "activity_availability":
        return reward.status === "locked"
          ? `${prettyLabel(reward.activityId)} hidden`
          : `${prettyLabel(reward.activityId)} ${reward.status}`;
    }
  });

  return ` Reward: ${labels.join(", ")}`;
}

function getQuestStepsLocal(quest: Quest): readonly QuestStep[] {
  if (quest.steps && quest.steps.length > 0) {
    return quest.steps;
  }

  return [
    {
      id: "runtime_objectives",
      completion: "automatic",
      objectives: [...(quest.objectives ?? [])]
    }
  ];
}

function getQuestStepByIdLocal(
  quest: Quest,
  stepId: string
): QuestStep | undefined {
  return getQuestStepsLocal(quest).find((step) => step.id === stepId);
}

function buildQuestSyncKey(
  activeSlotId: string | null,
  questLog: QuestLog | undefined,
  authoredQuests: readonly Quest[]
): string {
  const activeQuestEntries = Object.entries(questLog?.quests ?? {})
    .filter(([, entry]) => entry.status === "active" || entry.status === "completed")
    .map(
      ([questId, entry]) =>
        `${questId}:${entry.status}:${entry.currentStep}:${(entry.completedSteps ?? []).join(",")}`
    )
    .sort();

  return JSON.stringify({
    activeSlotId,
    authoredQuestCount: authoredQuests.length,
    activeQuestEntries
  });
}

function prettyLabel(value: string): string {
  return value
    .replace(/^quest_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatScore(value: number): string {
  return value.toFixed(1);
}

function resolveStepCompletionMode(step: QuestStep): "automatic" | "manual" {
  if (step.completion === "manual") {
    return "manual";
  }

  return "automatic";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}
