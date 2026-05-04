import { computed, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import type { Delta, Player } from "@rinner/grayvale-core";
import { Subject, type Observable } from "rxjs";

import { ActivitiesLoader } from "../../data/loaders/activities.loader";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import type {
  ActivityTickSnapshotView
} from "../../shared/components/activity-tick-feed/activity-tick-feed.types";
import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
import { GameDialogService } from "./game-dialog.service";
import { GameQuestService } from "./game-quest.service";
import { TickService, type TickEvent } from "./tick.service";

@Injectable({ providedIn: "root" })
export class ActivityService {
  private static readonly AUTO_CUTOFF_EMPTY_TICK_THRESHOLD = 3;

  private readonly roster = inject(CharacterRosterService);
  private readonly ticks = inject(TickService);
  private readonly gameQuests = inject(GameQuestService);
  private readonly gameDialog = inject(GameDialogService);
  private readonly activitiesLoader = inject(ActivitiesLoader);
  private readonly debugLog = inject(DebugLogService);

  private readonly activitiesState: GameActivityDefinition[] = [];
  private readonly tickAppliedSubject = new Subject<ActivityTickSnapshotView>();
  private readonly runItemTotals = new Map<string, number>();
  private emptyGrowthTickStreak = 0;

  /** Signal: the id of the currently active (ticking) activity, or null. */
  readonly activeActivityId = computed(
    () => this.roster.activeCharacter()?.activityState?.activeActivityId ?? null
  );

  /** Emits an `ActivityTickSnapshotView` after every processed activity tick. */
  readonly tickApplied$: Observable<ActivityTickSnapshotView> =
    this.tickAppliedSubject.asObservable();

  constructor() {
    this.activitiesLoader.load().subscribe({
      next: (activities) => {
        this.activitiesState.length = 0;
        this.activitiesState.push(...activities);
      },
      error: () => {
        this.debugLog.logMessage("activity", "Failed to load activity definitions.");
      }
    });

    this.ticks.registerTickType("activity", 1000);
    this.ticks.start();

    this.ticks
      .tick$("activity")
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        this.processTick(event);
      });
  }

  /**
   * Toggles the active activity:
   * - If `activityId` is already active → stops it.
   * - Otherwise → starts it (stopping any previously running activity first).
   */
  toggleActivity(activityId: string): boolean {
    if (this.activeActivityId() === activityId) {
      return this.stopActivity();
    }

    return this.startActivity(activityId);
  }

  startActivity(activityId: string): boolean {
    const player = this.roster.activeCharacter();

    if (!player) {
      return false;
    }

    const availability = player.activityState?.availability?.[activityId];

    if (!availability || availability.status !== "enabled") {
      this.debugLog.logMessage("activity", "Activity start rejected — not enabled.", {
        activityId,
        status: availability?.status ?? "missing"
      });
      return false;
    }

    const delta: Delta = {
      type: "set",
      target: "player",
      path: ["activityState", "activeActivityId"],
      value: activityId
    };

    const applied = this.roster.applyActiveCharacterDeltas([delta]) !== null;

    if (applied) {
      this.runItemTotals.clear();
      this.emptyGrowthTickStreak = 0;
      this.debugLog.logMessage("activity", "Activity started.", { activityId });
      const label = this.activitiesState.find((a) => a.id === activityId)?.name ?? activityId;
      this.gameDialog.startActivity(activityId, label);
    }

    return applied;
  }

  stopActivity(): boolean {
    const activityId = this.activeActivityId();

    const delta: Delta = {
      type: "set",
      target: "player",
      path: ["activityState", "activeActivityId"],
      value: null
    };

    const applied = this.roster.applyActiveCharacterDeltas([delta]) !== null;

    if (applied) {
      this.runItemTotals.clear();
      this.emptyGrowthTickStreak = 0;
      this.debugLog.logMessage("activity", "Activity stopped.", { activityId });
      this.gameDialog.stopActivity();
    }

    return applied;
  }

  private processTick(event: TickEvent): void {
    const activityId = this.activeActivityId();

    if (!activityId) {
      return;
    }

    const appliedDeltas = this.gameQuests.executeActivityTick(activityId);
    const activity = this.activitiesState.find((entry) => entry.id === activityId);
    const growth = summarizeGrowth(appliedDeltas, event.elapsedMs);
    const player = this.roster.activeCharacter();

    for (const [key, amount] of growth.itemTotalsByKey) {
      this.runItemTotals.set(key, (this.runItemTotals.get(key) ?? 0) + amount);
    }

    const hasValuableGrowth = growth.hasValuableGrowth;
    this.emptyGrowthTickStreak = hasValuableGrowth ? 0 : this.emptyGrowthTickStreak + 1;

    const cutoffRule = this.resolveCutoffRule(activityId, hasValuableGrowth);

    const snapshot: ActivityTickSnapshotView = {
      id: `${activityId}:${event.at}:${event.tickNumber}`,
      activityId,
      activityLabel: activity?.name ?? activityId,
      tickNumber: event.tickNumber,
      occurredAtLabel: new Date(event.at).toLocaleTimeString(),
      attributeSkillDeltaLabel: growth.attributeSkillTickLabel,
      currentAttributeSkillLevelLabel: buildCurrentLevelLabel(appliedDeltas, player),
      attributeSkillPerHourLabel: growth.attributeSkillPerHourLabel,
      itemGainLabel: growth.itemGainLabel,
      itemTotalGainLabel: formatAggregateLabel(this.runItemTotals),
      cutoffRuleLabel: cutoffRule.label,
      isCutoffTriggered: cutoffRule.shouldCutoff
    };

    this.tickAppliedSubject.next(snapshot);
    this.gameDialog.appendActivityTick(snapshot);

    if (cutoffRule.shouldCutoff) {
      this.debugLog.logMessage("activity", "Activity auto-cutoff reached.", {
        activityId,
        rule: cutoffRule.label,
        emptyGrowthTickStreak: this.emptyGrowthTickStreak
      });
      this.stopActivity();
    }
  }

  private resolveCutoffRule(
    activityId: string,
    hasValuableGrowth: boolean
  ): { shouldCutoff: boolean; label: string } {
    const availability = this.roster.activeCharacter()?.activityState?.availability?.[activityId];

    if (!availability || availability.status !== "enabled") {
      const reason = availability?.disabledReason ?? "activity is no longer enabled";
      return {
        shouldCutoff: true,
        label: `Cutoff reached: ${reason}.`
      };
    }

    if (!hasValuableGrowth && this.emptyGrowthTickStreak >= ActivityService.AUTO_CUTOFF_EMPTY_TICK_THRESHOLD) {
      return {
        shouldCutoff: true,
        label: `Cutoff reached: no valuable growth for ${ActivityService.AUTO_CUTOFF_EMPTY_TICK_THRESHOLD} consecutive ticks.`
      };
    }

    return {
      shouldCutoff: false,
      label: `Auto-cutoff when growth stops being valuable (${this.emptyGrowthTickStreak}/${ActivityService.AUTO_CUTOFF_EMPTY_TICK_THRESHOLD} empty ticks).`
    };
  }
}

// ---------------------------------------------------------------------------
// Delta → summary helpers
// ---------------------------------------------------------------------------

type GrowthSummary = {
  readonly attributeSkillTickLabel: string;
  readonly attributeSkillPerHourLabel: string;
  readonly itemGainLabel: string;
  readonly itemTotalsByKey: ReadonlyMap<string, number>;
  readonly hasValuableGrowth: boolean;
};

function summarizeGrowth(deltas: readonly Delta[], elapsedMs: number): GrowthSummary {
  const attributeSkill = new Map<string, number>();
  const itemTick = new Map<string, number>();

  for (const delta of deltas) {
    const amount = toDeltaAmount(delta);

    if (amount === null) {
      continue;
    }

    const bucket = classifyDeltaPath(delta.path);
    const label = deriveLabel(delta.path);

    if (bucket === "attribute" || bucket === "skill") {
      attributeSkill.set(label, (attributeSkill.get(label) ?? 0) + amount);
      continue;
    }

    if (bucket === "item" || bucket === "currency") {
      itemTick.set(label, (itemTick.get(label) ?? 0) + amount);
    }
  }

  const safeElapsedMs = elapsedMs > 0 ? elapsedMs : 1000;
  const perHour = new Map<string, number>();

  for (const [label, amount] of attributeSkill) {
    perHour.set(label, amount * (3_600_000 / safeElapsedMs));
  }

  const hasValuableGrowth =
    hasPositiveAmount(attributeSkill) || hasPositiveAmount(itemTick);

  return {
    attributeSkillTickLabel: formatAggregateLabel(attributeSkill),
    attributeSkillPerHourLabel: formatAggregateLabel(perHour, "/h"),
    itemGainLabel: formatAggregateLabel(itemTick),
    itemTotalsByKey: itemTick,
    hasValuableGrowth
  };
}

function hasPositiveAmount(values: ReadonlyMap<string, number>): boolean {
  for (const amount of values.values()) {
    if (amount > 0) {
      return true;
    }
  }

  return false;
}

function formatAggregateLabel(values: ReadonlyMap<string, number>, suffix = ""): string {
  if (values.size === 0) {
    return "None";
  }

  return [...values.entries()]
    .map(([label, amount]) => `${label} ${formatSigned(amount)}${suffix}`)
    .join(", ");
}

function classifyDeltaPath(path: readonly string[]): "attribute" | "skill" | "item" | "currency" | "unknown" {
  if (path[0] === "attributes") return "attribute";
  if (path[0] === "skills") return "skill";
  if (path[0] === "inventory" && path[1] === "items") return "item";
  if (path[0] === "inventory" && path[1] === "currencies") return "currency";
  return "unknown";
}

function deriveLabel(path: readonly string[]): string {
  if (path[0] === "attributes" && path[1]) return `Attribute: ${prettyId(path[1])}`;
  if (path[0] === "skills" && path[1]) return `Skill: ${prettyId(path[1])}`;
  if (path[0] === "inventory" && path[1] === "items" && path[2]) {
    return `Item: ${prettyId(path[2])}`;
  }
  if (path[0] === "inventory" && path[1] === "currencies" && path[2]) {
    return `Currency: ${prettyId(path[2])}`;
  }

  return path.join(".");
}

function toDeltaAmount(delta: Delta): number | null {
  if (typeof delta.value !== "number") {
    return null;
  }

  if (delta.type === "add") {
    return delta.value;
  }

  return null;
}

function buildCurrentLevelLabel(deltas: readonly Delta[], player: Player | null): string {
  if (!player) {
    return "Unavailable";
  }

  const levels = new Map<string, number>();

  for (const delta of deltas) {
    const path = delta.path;

    if (path[0] === "attributes" && path[1]) {
      const value = player.attributes[path[1]];
      if (typeof value === "number") {
        levels.set(`Attribute: ${prettyId(path[1])}`, value);
      }
      continue;
    }

    if (path[0] === "skills" && path[1]) {
      const value = player.skills[path[1]];
      if (typeof value === "number") {
        levels.set(`Skill: ${prettyId(path[1])}`, value);
      }
    }
  }

  if (levels.size === 0) {
    return "None";
  }

  return [...levels.entries()]
    .map(([label, value]) => `${label} ${formatNumber(value)}`)
    .join(", ");
}

function prettyId(value: string): string {
  return value
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  return formatNumber(value);
}
