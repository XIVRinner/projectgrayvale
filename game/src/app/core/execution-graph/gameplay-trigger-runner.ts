import { Injectable, inject } from "@angular/core";

import { ActivityService } from "../services/activity.service";
import { DebugLogService } from "../services/game-log/debug-log.service";
import { GameDialogService } from "../services/game-dialog.service";
import { GameQuestService } from "../services/game-quest.service";
import { WorldStateService } from "../services/world-state.service";
import type { ActionNode, ExecutionResult, MovementExecution } from "./gameplay-execution-graph.types";

@Injectable({ providedIn: "root" })
export class GameplayTriggerRunner {
  private readonly activityService = inject(ActivityService);
  private readonly worldState = inject(WorldStateService);
  private readonly gameQuests = inject(GameQuestService);
  private readonly gameDialog = inject(GameDialogService);
  private readonly debugLog = inject(DebugLogService);

  run(action: ActionNode): ExecutionResult {
    const { execution } = action;

    switch (execution.kind) {
      case "movement":
        return this.runMovement(action);
      case "activity":
        return this.runActivity(action);
      case "dialogue":
        return this.runDialogue(action);
      case "system":
        return this.runSystem(action);
      default:
        return blocked(action.id, "UNKNOWN_EXECUTION_KIND");
    }
  }

  private runMovement(action: ActionNode): ExecutionResult {
    const { execution } = action;

    if (execution.kind !== "movement") {
      return blocked(action.id, "EXECUTION_KIND_MISMATCH");
    }

    const movement = execution as MovementExecution;
    let committed = false;

    switch (movement.movementKind) {
      case "sublocation-enter": {
        if (!movement.targetSublocationId) {
          return blocked(action.id, "MISSING_TARGET_SUBLOCATION");
        }
        committed = this.worldState.executeEnterSublocation(movement.targetSublocationId);
        break;
      }
      case "sublocation-exit": {
        committed = this.worldState.executeExitSublocation();
        break;
      }
      case "travel": {
        if (!movement.targetLocationId) {
          return blocked(action.id, "MISSING_TARGET_LOCATION");
        }
        const world = this.worldState.currentWorld();
        if (!world) {
          return blocked(action.id, "NO_ACTIVE_WORLD");
        }
        committed = this.worldState.executeTravel(world.currentLocation, movement.targetLocationId);
        break;
      }
    }

    if (!committed) {
      this.debugLog.logMessage("execution-graph", "Movement execution failed.", {
        actionId: action.id,
        movementKind: movement.movementKind
      });
      return blocked(action.id, "MOVEMENT_COMMIT_FAILED");
    }

    return { ok: true, actionId: action.id };
  }

  private runActivity(action: ActionNode): ExecutionResult {
    const { execution } = action;

    if (execution.kind !== "activity") {
      return blocked(action.id, "EXECUTION_KIND_MISMATCH");
    }

    const applied = this.activityService.toggleActivity(execution.activityId);
    if (!applied) {
      return blocked(action.id, "ACTIVITY_REJECTED");
    }

    return { ok: true, actionId: action.id };
  }

  private runDialogue(action: ActionNode): ExecutionResult {
    const { execution } = action;

    if (execution.kind !== "dialogue") {
      return blocked(action.id, "EXECUTION_KIND_MISMATCH");
    }

    switch (execution.dialogueTarget) {
      case "prologue":
        this.gameDialog.startPrologue();
        return { ok: true, actionId: action.id };
      case "chief-labour":
        this.gameDialog.startChiefLabour();
        return { ok: true, actionId: action.id };
      default:
        this.debugLog.logMessage(
          "execution-graph",
          `Unknown dialogue target "${execution.dialogueTarget}".`,
          { actionId: action.id }
        );
        return blocked(action.id, "UNKNOWN_DIALOGUE_TARGET");
    }
  }

  private runSystem(action: ActionNode): ExecutionResult {
    const { execution } = action;

    if (execution.kind !== "system") {
      return blocked(action.id, "EXECUTION_KIND_MISMATCH");
    }

    this.debugLog.logMessage(
      "execution-graph",
      `System command "${execution.command}" is not yet handled.`,
      { actionId: action.id }
    );

    return blocked(action.id, "UNHANDLED_SYSTEM_COMMAND");
  }
}

function blocked(actionId: string, reason: string): ExecutionResult {
  return { ok: false, actionId, reason };
}
