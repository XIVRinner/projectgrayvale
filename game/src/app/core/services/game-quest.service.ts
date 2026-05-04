import { effect, Injectable, inject, signal } from "@angular/core";
import {
  type ActivityDefinition,
  type ActivityReward,
  type Delta,
  type Player,
  type Quest,
  type QuestLog,
  type QuestObjective,
  type QuestReward
} from "@rinner/grayvale-core";
import { Subject, type Subscription } from "rxjs";

import { ActivitiesLoader } from "../../data/loaders/activities.loader";
import { QuestsLoader } from "../../data/loaders/quests.loader";
import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
import type { GameQuestEvent } from "./game-quest.types";
import { QuestTracker, type QuestRuntimeState } from "./quest-tracker/quest-tracker";

const RECOVERY_ACTIVITY_ID = "recover";
const RECOVERY_QUEST_ID = "quest_recovery";
const CHIEF_LABOUR_ACTIVITY_ID = "village-labour";
const CHIEF_LABOUR_QUEST_ID = "quest_chief_labour";
const QUEST_RUNTIME_STEP_ID = "runtime_objectives";
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
  private readonly activitiesState = signal<readonly ActivityDefinition[]>([]);
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
      this.runtimeStatesState.set(this.questTracker.getState());

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
      this.handleQuestCompleted(questId);
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

      if (this.reconcileScriptedQuestState()) {
        return;
      }

      const syncKey = buildQuestSyncKey(
        this.roster.activeSlotId(),
        this.roster.activeCharacter()?.questLog,
        this.authoredQuestsState()
      );

      if (syncKey === this.lastSyncKey) {
        return;
      }

      this.refreshActiveQuests();
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
        this.refreshActiveQuests();
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

    if (!player) {
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
          currentStep: QUEST_RUNTIME_STEP_ID,
          status: "active"
        },
        meta: {
          gameplayLogHandledBy: "quest-event"
        }
      }
    ];

    if (quest.id === RECOVERY_QUEST_ID) {
      deltas.push({
        type: "set",
        target: "player",
        path: ["activityState", "availability", RECOVERY_ACTIVITY_ID],
        value: {
          status: "enabled"
        }
      });
    }

    if (quest.id === CHIEF_LABOUR_QUEST_ID) {
      deltas.push({
        type: "set",
        target: "player",
        path: ["activityState", "availability", CHIEF_LABOUR_ACTIVITY_ID],
        value: {
          status: "enabled"
        }
      });
    }

    const updatedSlot = this.roster.applyActiveCharacterDeltas(deltas);

    if (!updatedSlot) {
      this.debugLog.logMessage("quest", "Quest start failed because quest deltas could not be applied.", {
        questId: quest.id
      });
      return false;
    }

    this.pendingQuestStartIds.delete(quest.id);
    const message = `Quest received: ${describeQuestInstruction(quest)}.`;

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

    const deltas = buildActivityRewardDeltas(activity);

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

    const deltas = buildActivityRewardDeltas(activity);

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

    this.debugLog.logMessage("quest", "Refreshing active quest tracker state.", {
      activeQuestIds
    });
    this.questTracker.loadActiveQuests(activeQuests);
    seedTrackerFromPlayer(this.questTracker, player, activeQuests);
    this.runtimeStatesState.set(this.questTracker.getState());
  }

  private handleQuestCompleted(questId: string): void {
    const activePlayer = this.roster.activeCharacter();
    const quest = this.authoredQuestsState().find((entry) => entry.id === questId);

    if (!activePlayer || !quest) {
      this.debugLog.logMessage("quest", "Quest completion ignored because the player or quest definition was missing.", {
        questId
      });
      return;
    }

    const currentStatus = activePlayer.questLog?.quests[questId]?.status;

    if (currentStatus === "completed") {
      this.debugLog.logMessage("quest", "Quest completion skipped because the quest was already completed.", {
        questId
      });
      return;
    }

    const deltas: Delta[] = [
      {
        type: "set",
        target: "player",
        path: ["questLog", "quests", questId],
        value: {
          currentStep: QUEST_RUNTIME_STEP_ID,
          status: "completed",
          completedSteps: [QUEST_RUNTIME_STEP_ID]
        },
        meta: {
          gameplayLogHandledBy: "quest-event"
        }
      }
    ];

    deltas.push(...buildQuestRewardDeltas(quest.rewards));

    this.roster.applyActiveCharacterDeltas(deltas);
    applyQuestRewards(this.roster, quest.rewards);
    const message =
      `Quest complete: ${describeQuestInstruction(quest)}${describeQuestRewards(quest.rewards)}.`;

    this.latestQuestMessageState.set(message);
    this.debugLog.logMessage("quest", "Quest completed.", {
      questId,
      message
    });
    this.eventSubject.next({
      type: "quest-completed",
      questId,
      message
    });
    this.refreshActiveQuests();
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

    if (!quest || quest.objectives.length === 0) {
      return null;
    }

    const objective = quest.objectives[0];
    const progress = state.objectives[`${state.questId}:0`];

    if (!progress) {
      return null;
    }

    if (objective.type === "attribute_reached") {
      return `${prettyLabel(objective.attribute)} ${formatScore(progress.current)} / ${formatScore(progress.target)}`;
    }

    return describeQuestInstruction(quest);
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
  quests: readonly Quest[]
): void {
  const seededAttributes = new Set<string>();
  const seededItems = new Set<string>();

  quests.forEach((quest) => {
    seedQuestObjectives(tracker, player, quest.objectives, seededAttributes, seededItems);
  });
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

function buildActivityRewardDeltas(activity: ActivityDefinition): Delta[] {
  return (activity.rewards ?? []).map((reward, index) =>
    buildActivityRewardDelta(activity, reward, index === 0)
  );
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
      case "activity_availability":
        break;
    }
  }
}

function buildActivityRewardDelta(
  activity: ActivityDefinition,
  reward: ActivityReward,
  attachActivityMeta: boolean
): Delta {
  if (
    reward.type !== "attribute" ||
    typeof reward.targetId !== "string" ||
    reward.value.type !== "flat"
  ) {
    throw new Error(
      `Activity "${activity.id}" currently supports only flat attribute rewards in the game runtime.`
    );
  }

  return {
    type: "add",
    target: "player",
    path: ["attributes", reward.targetId],
    value: reward.value.amount,
    meta: attachActivityMeta
      ? {
          activityTick: {
            activityId: activity.id,
            difficulty: activity.difficulty,
            governingAttributes: activity.governingAttributes,
            tags: activity.tags,
            tickDelta: 1,
            duration: 1
          }
        }
      : undefined
  };
}

function describeQuestInstruction(quest: Quest): string {
  const objective = quest.objectives[0];

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
      case "activity_availability":
        return reward.status === "locked"
          ? `${prettyLabel(reward.activityId)} hidden`
          : `${prettyLabel(reward.activityId)} ${reward.status}`;
    }
  });

  return ` Reward: ${labels.join(", ")}`;
}

function buildQuestSyncKey(
  activeSlotId: string | null,
  questLog: QuestLog | undefined,
  authoredQuests: readonly Quest[]
): string {
  const activeQuestEntries = Object.entries(questLog?.quests ?? {})
    .filter(([, entry]) => entry.status === "active" || entry.status === "completed")
    .map(([questId, entry]) => `${questId}:${entry.status}`)
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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
