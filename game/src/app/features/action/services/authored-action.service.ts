import { Injectable, computed, inject, signal } from "@angular/core";

import { CharacterRosterService } from "../../../core/services/character-roster.service";
import type { SaveSlotHealthState } from "../../../core/services/health-balance";
import { DebugLogService } from "../../../core/services/game-log/debug-log.service";
import {
  ActionsLoader,
  type AuthoredActionDefinition,
} from "../../../data/loaders/actions.loader";
import { ActionCostService } from "./action-cost.service";

export interface AuthoredActionExecutionResult {
  readonly ok: boolean;
  readonly reason?: string;
}

@Injectable({ providedIn: "root" })
export class AuthoredActionService {
  private readonly actionsLoader = inject(ActionsLoader);
  private readonly roster = inject(CharacterRosterService);
  private readonly costService = inject(ActionCostService);
  private readonly debugLog = inject(DebugLogService);

  private readonly actionsState = signal<readonly AuthoredActionDefinition[]>(
    [],
  );

  readonly actionsById = computed(
    () =>
      new Map(
        this.actionsState().map((action) => [action.id, action] as const),
      ),
  );

  constructor() {
    this.actionsLoader.load().subscribe({
      next: (actions) => {
        this.actionsState.set(actions);
      },
      error: (error: unknown) => {
        this.actionsState.set([]);
        this.debugLog.logMessage(
          "action",
          "Failed to load authored actions.",
          toErrorMessage(error),
          "error",
        );
      },
    });
  }

  executeActionById(actionId: string): AuthoredActionExecutionResult {
    const action = this.actionsById().get(actionId);

    if (!action) {
      return {
        ok: false,
        reason: `Unknown action "${actionId}".`,
      };
    }

    const player = this.roster.activeCharacter();
    const health = this.roster.activeHealth();

    if (!player || !health) {
      return {
        ok: false,
        reason: "No active player health state.",
      };
    }

    if (
      typeof action.requirements?.minLevel === "number" &&
      player.progression.level < action.requirements.minLevel
    ) {
      return {
        ok: false,
        reason: `Requires level ${action.requirements.minLevel}.`,
      };
    }

    const costResult = this.costService.calculateCost(
      action,
      player,
      health.currentHp,
      health.maxHp,
    );

    if (!costResult.affordable) {
      return {
        ok: false,
        reason: `Needs ${costResult.calculatedCost} coins.`,
      };
    }

    const nextMoney = Math.max(0, player.money - costResult.calculatedCost);
    const playerUpdated =
      this.roster.applyActiveCharacterDeltas([
        {
          type: "set",
          target: "player",
          path: ["money"],
          value: nextMoney,
        },
      ]) !== null;

    if (!playerUpdated) {
      return {
        ok: false,
        reason: "Failed to spend the action cost.",
      };
    }

    const nextHealth = resolveActionHealthEffect(action, health);

    if (nextHealth) {
      const healthUpdated = this.roster.updateActiveHealth(nextHealth) !== null;

      if (!healthUpdated) {
        return {
          ok: false,
          reason: "Failed to apply the healing effect.",
        };
      }
    }

    this.debugLog.logMessage("action", "Executed authored action.", {
      actionId,
      spentMoney: costResult.calculatedCost,
      effect: action.effect.type,
    });

    return { ok: true };
  }
}

function resolveActionHealthEffect(
  action: AuthoredActionDefinition,
  health: SaveSlotHealthState,
): SaveSlotHealthState | null {
  switch (action.effect.type) {
    case "heal_full":
      return {
        currentHp: health.maxHp,
        maxHp: health.maxHp,
      };
    case "restore_resource":
      return null;
    case "heal_partial":
      // GAP: Authored partial-heal payload contract
      // Blocked on: design
      // Needs: a documented meta schema for heal_partial (fixed amount, percent, or formula)
      // Do not implement until: actions.json authorship defines the heal_partial payload shape
      return null;
  }

  return null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown authored action load error.";
}
