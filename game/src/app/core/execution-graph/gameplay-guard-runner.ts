import type { Guard, GuardContext } from "@rinner/grayvale-worldgraph";

import type { WorldGuardCatalog } from "../../data/loaders/world-guards.loader";
import {
  evaluateWorldGuard,
  type WorldGuardEvaluationResult
} from "../services/world-guard-evaluator";

/**
 * Evaluates a guard using the extended execution-graph guard set.
 *
 * Handles all guard types from the world guard evaluator plus additional
 * guard types that are specific to execution graph action conditions
 * (e.g. story state negations that are not needed for navigation guards).
 */
export function evaluateExecutionGuard(
  guard: Guard,
  context: GuardContext,
  catalog: WorldGuardCatalog
): WorldGuardEvaluationResult {
  if (isExecutionGraphGuardType(guard.type)) {
    return evaluateKnownExecutionGuard(guard, context);
  }

  return evaluateWorldGuard(guard, context, catalog);
}

export function evaluateExecutionGuards(
  guards: readonly Guard[] | undefined,
  context: GuardContext,
  catalog: WorldGuardCatalog
): WorldGuardEvaluationResult {
  if (!guards || guards.length === 0) {
    return { passes: true };
  }

  for (const guard of guards) {
    const result = evaluateExecutionGuard(guard, context, catalog);

    if (!result.passes) {
      return result;
    }
  }

  return { passes: true };
}

// ---------------------------------------------------------------------------
// Execution-graph-specific guard types
// ---------------------------------------------------------------------------

/**
 * Guard types owned exclusively by the Gameplay Execution Graph.
 * These are NOT registered in world-guards.json because they exist only
 * as action-level conditions compiled into graph nodes.
 */
const EXECUTION_GRAPH_GUARD_TYPES = new Set<string>([
  "story_chapter_below",
  "story_arc_active",
  "story_prologue_pending",
  "activity_available",
  "activity_enabled",
  "activity_is_active"
]);

function isExecutionGraphGuardType(type: string): boolean {
  return EXECUTION_GRAPH_GUARD_TYPES.has(type);
}

function evaluateKnownExecutionGuard(
  guard: Guard,
  context: GuardContext
): WorldGuardEvaluationResult {
  switch (guard.type) {
    /**
     * Passes when the player's story chapter is strictly below maxChapter.
     * Optional: `arcId` requires the player to be in that arc.
     *
     * Example: { type: "story_chapter_below", params: { maxChapter: 2, arcId: "prologue" } }
     */
    case "story_chapter_below": {
      const maxChapter = readNumericParam(guard.params, "maxChapter");
      const requiredArcId = readOptionalStringParam(guard.params, "arcId");
      const story = context.player.story;

      if (!story) {
        return { passes: false, failureReason: "No active story." };
      }

      if (requiredArcId && story.currentArcId !== requiredArcId) {
        return {
          passes: false,
          failureReason: `Story arc "${requiredArcId}" is not active.`
        };
      }

      if (story.currentChapter < maxChapter) {
        return { passes: true };
      }

      return { passes: false, failureReason: "Story chapter has already passed." };
    }

    /**
     * Passes when the player's story arc matches `arcId`.
     *
     * Example: { type: "story_arc_active", params: { arcId: "prologue" } }
     */
    case "story_arc_active": {
      const requiredArcId = readOptionalStringParam(guard.params, "arcId");
      const story = context.player.story;

      if (!story) {
        return { passes: false, failureReason: "No active story." };
      }

      if (!requiredArcId) {
        return { passes: false, failureReason: "Guard is missing arcId parameter." };
      }

      if (story.currentArcId === requiredArcId) {
        return { passes: true };
      }

      return { passes: false, failureReason: `Story arc "${requiredArcId}" is not active.` };
    }

    /**
     * Composite: story arc is "prologue" AND chapter < 2.
     * Shorthand used by the wake-up action.
     */
    case "story_prologue_pending": {
      const story = context.player.story;

      if (!story) {
        return { passes: false, failureReason: "No active story." };
      }

      if (story.currentArcId === "prologue" && story.currentChapter < 2) {
        return { passes: true };
      }

      return { passes: false, failureReason: "Prologue has already been completed." };
    }

    /**
     * Passes when the activity exists in the player's availability state
     * with any status other than "locked" (i.e., the player has unlocked it).
     *
     * Example: { type: "activity_available", params: { activityId: "recover" } }
     */
    case "activity_available": {
      const activityId = readOptionalStringParam(guard.params, "activityId");

      if (!activityId) {
        return { passes: false, failureReason: "Guard is missing activityId parameter." };
      }

      const availability = context.player.activityState?.availability?.[activityId];

      if (!availability || availability.status === "locked") {
        return { passes: false, failureReason: "Activity is locked." };
      }

      return { passes: true };
    }

    /**
     * Passes when the activity is enabled for the player right now.
     * Uses the stored `disabledReason` from player state when the guard fails.
     *
     * Example: { type: "activity_enabled", params: { activityId: "recover" } }
     */
    case "activity_enabled": {
      const activityId = readOptionalStringParam(guard.params, "activityId");

      if (!activityId) {
        return { passes: false, failureReason: "Guard is missing activityId parameter." };
      }

      const availability = context.player.activityState?.availability?.[activityId];

      if (!availability) {
        return { passes: false, failureReason: "Activity unavailable." };
      }

      if (availability.status === "enabled") {
        return { passes: true };
      }

      return {
        passes: false,
        failureReason: availability.disabledReason ?? "Activity is currently unavailable."
      };
    }

    /**
     * Passes when the given activity is the currently running (active) activity.
     * Used to show toggle / stop state on activity action buttons.
     *
     * Example: { type: "activity_is_active", params: { activityId: "recover" } }
     */
    case "activity_is_active": {
      const activityId = readOptionalStringParam(guard.params, "activityId");

      if (!activityId) {
        return { passes: false, failureReason: "Guard is missing activityId parameter." };
      }

      const activeActivityId = context.player.activityState?.activeActivityId;

      if (activeActivityId === activityId) {
        return { passes: true };
      }

      return { passes: false, failureReason: "Activity is not currently active." };
    }

    default:
      return { passes: false, failureReason: `Unknown execution guard type "${guard.type}".` };
  }
}

function readNumericParam(
  params: Record<string, unknown> | undefined,
  key: string
): number {
  const value = params?.[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    return Number.POSITIVE_INFINITY;
  }

  return value;
}

function readOptionalStringParam(
  params: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value;
}
