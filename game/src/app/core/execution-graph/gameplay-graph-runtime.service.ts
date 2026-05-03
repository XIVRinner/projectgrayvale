import {
  Injectable,
  computed,
  inject,
  signal
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import type { GuardContext } from "@rinner/grayvale-worldgraph";

import {
  mergeActionPanelGroups,
  type ActionPanelGroupView
} from "../../shared/models/action-panel-group.model";
import { ActivitiesLoader } from "../../data/loaders/activities.loader";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import { CharacterRosterService } from "../services/character-roster.service";
import { DebugLogService } from "../services/game-log/debug-log.service";
import { WorldStateService } from "../services/world-state.service";
import {
  buildContextId,
  compileGameplayGraph,
  type CompileInput
} from "./gameplay-graph-compiler";
import { evaluateExecutionGuards } from "./gameplay-guard-runner";
import { logDiagnostics } from "./gameplay-graph-diagnostics";
import { GameplayTriggerRunner } from "./gameplay-trigger-runner";
import type {
  ActionId,
  ActionView,
  CompileResult,
  ExecutionResult,
  GameplayExecutionGraph
} from "./gameplay-execution-graph.types";

export type { ActionView };

export type GameplayActionChoice = {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
};

export type GameplayActionGroup = ActionPanelGroupView<GameplayActionChoice>;

@Injectable({ providedIn: "root" })
export class GameplayGraphRuntime {
  private readonly roster = inject(CharacterRosterService);
  private readonly worldState = inject(WorldStateService);
  private readonly activitiesLoader = inject(ActivitiesLoader);
  private readonly triggerRunner = inject(GameplayTriggerRunner);
  private readonly debugLog = inject(DebugLogService);

  private readonly activitiesState = signal<readonly GameActivityDefinition[]>([]);
  private readonly activitiesLoadedState = signal(false);

  /**
   * The compiled execution graph, derived reactively from loaded data.
   * Recompiles automatically whenever the world data or activity registry changes.
   * Guard evaluation is NOT part of compilation — it happens in `actionGroups`.
   */
  private readonly compiledResult = computed<CompileResult | null>(() => {
    const worldGraph = this.worldState.worldGraph();
    const locationsCatalog = this.worldState.worldLocationsCatalog();
    const guardCatalog = this.worldState.worldGuardCatalog();

    if (!worldGraph || !locationsCatalog || !guardCatalog) {
      return null;
    }

    const input: CompileInput = {
      worldGraph,
      locationsCatalog,
      guardCatalog,
      activities: this.activitiesState()
    };

    const result = compileGameplayGraph(input);

    logDiagnostics(
      result.diagnostics.filter(
        (d) => d.severity === "error" || d.severity === "warning"
      )
    );

    return result;
  });

  private readonly graph = computed<GameplayExecutionGraph | null>(
    () => this.compiledResult()?.graph ?? null
  );

  readonly loadError = computed(() => this.worldState.loadError());

  readonly isReady = computed(
    () =>
      this.worldState.isReady() &&
      this.activitiesLoadedState() &&
      this.graph() !== null &&
      this.loadError() === null
  );

  /**
   * The player-facing action groups for the current context.
   * Recomputed whenever location, world state, or player state changes.
   * Graph compilation is separate and only triggered by structural data changes.
   */
  readonly actionGroups = computed<readonly GameplayActionGroup[]>(() => {
    const graph = this.graph();
    const activeSlot = this.roster.activeSlot();
    const world = this.roster.activeWorld();
    const guardCatalog = this.worldState.worldGuardCatalog();

    if (!graph || !activeSlot || !world || !guardCatalog) {
      return [];
    }

    const contextId = buildContextId(
      world.currentLocation,
      world.sublocations.at(-1)
    );

    const context = graph.contextsById.get(contextId);

    if (!context) {
      return [];
    }

    const guardContext: GuardContext = {
      player: activeSlot.player,
      npcs: {},
      world: {
        currentLocation: world.currentLocation,
        sublocations: [...world.sublocations]
      }
    };

    const views: ActionView[] = [];

    for (const actionId of context.actionIds) {
      const action = graph.actionsById.get(actionId);

      if (!action) {
        continue;
      }

      const visibilityResult = evaluateExecutionGuards(
        action.visibleWhen,
        guardContext,
        guardCatalog
      );

      if (!visibilityResult.passes) {
        continue;
      }

      const enabledResult = evaluateExecutionGuards(
        action.enabledWhen,
        guardContext,
        guardCatalog
      );

      views.push({
        id: action.id,
        label: action.label,
        visible: true,
        enabled: enabledResult.passes,
        disabledReason: enabledResult.passes ? undefined : enabledResult.failureReason,
        groupKind: action.groupKind
      });
    }

    return buildActionGroups(views);
  });

  constructor() {
    this.activitiesLoader
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (activities) => {
          this.activitiesState.set(activities);
          this.activitiesLoadedState.set(true);
        },
        error: () => {
          this.activitiesState.set([]);
          this.activitiesLoadedState.set(true);
        }
      });
  }

  executeAction(actionId: ActionId): ExecutionResult {
    const graph = this.graph();

    if (!graph) {
      this.debugLog.logMessage("execution-graph", "Execute rejected: graph not compiled.", {
        actionId
      });
      return { ok: false, actionId, reason: "GRAPH_NOT_COMPILED" };
    }

    const action = graph.actionsById.get(actionId);

    if (!action) {
      this.debugLog.logMessage("execution-graph", "Execute rejected: action not found.", {
        actionId
      });
      return { ok: false, actionId, reason: "ACTION_NOT_FOUND" };
    }

    const world = this.roster.activeWorld();
    const activeSlot = this.roster.activeSlot();

    if (!world || !activeSlot) {
      return { ok: false, actionId, reason: "NO_ACTIVE_SLOT" };
    }

    const currentContextId = buildContextId(
      world.currentLocation,
      world.sublocations.at(-1)
    );

    if (action.contextId !== currentContextId) {
      this.debugLog.logMessage(
        "execution-graph",
        "Execute rejected: action not in current context.",
        {
          actionId,
          actionContextId: action.contextId,
          currentContextId
        }
      );
      return { ok: false, actionId, reason: "ACTION_NOT_IN_CONTEXT" };
    }

    const guardCatalog = this.worldState.worldGuardCatalog();

    if (!guardCatalog) {
      return { ok: false, actionId, reason: "GUARD_CATALOG_UNAVAILABLE" };
    }

    const guardContext: GuardContext = {
      player: activeSlot.player,
      npcs: {},
      world: {
        currentLocation: world.currentLocation,
        sublocations: [...world.sublocations]
      }
    };

    const visibilityResult = evaluateExecutionGuards(
      action.visibleWhen,
      guardContext,
      guardCatalog
    );

    if (!visibilityResult.passes) {
      this.debugLog.logMessage("execution-graph", "Execute rejected: action not visible.", {
        actionId,
        reason: visibilityResult.failureReason
      });
      return { ok: false, actionId, reason: "ACTION_NOT_VISIBLE" };
    }

    const enabledResult = evaluateExecutionGuards(
      action.enabledWhen,
      guardContext,
      guardCatalog
    );

    if (!enabledResult.passes) {
      this.debugLog.logMessage("execution-graph", "Execute rejected: action disabled.", {
        actionId,
        reason: enabledResult.failureReason
      });
      return {
        ok: false,
        actionId,
        reason: enabledResult.failureReason ?? "ACTION_DISABLED"
      };
    }

    this.debugLog.logMessage("execution-graph", "Executing action.", {
      actionId,
      contextId: action.contextId,
      kind: action.execution.kind
    });

    const result = this.triggerRunner.run(action);

    this.debugLog.logMessage(
      "execution-graph",
      result.ok ? "Action executed." : "Action execution failed.",
      { actionId, reason: result.ok ? undefined : result.reason }
    );

    return result;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildActionGroups(
  views: readonly ActionView[]
): readonly GameplayActionGroup[] {
  const drafts = views
    .filter((v) => v.visible)
    .map((v) => ({
      kind: v.groupKind,
      choices: [
        {
          id: v.id,
          label: v.label,
          disabled: v.enabled ? undefined : true,
          disabledReason: v.disabledReason
        } as GameplayActionChoice
      ]
    }));

  return mergeActionPanelGroups(drafts);
}
