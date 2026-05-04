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
  buildActivityActionId,
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

export type GameplayGraphDebugContext = {
  readonly id: string;
  readonly locationId: string;
  readonly sublocationId?: string;
  readonly actionCount: number;
  readonly isCurrent: boolean;
};

export type GameplayGraphDebugAction = {
  readonly id: string;
  readonly label: string;
  readonly groupKind: string;
  readonly executionKind: string;
  readonly visibleGuards: readonly string[];
  readonly enabledGuards: readonly string[];
  readonly isVisible: boolean;
  readonly isEnabled: boolean;
  readonly disabledReason?: string;
};

export type GameplayGraphDebugActivity = {
  readonly id: string;
  readonly authoredContextId: string;
  readonly compiled: boolean;
  readonly compiledContextId?: string;
};

export type GameplayGraphDebugSnapshot = {
  readonly graphVersion: number;
  readonly contextCount: number;
  readonly actionCount: number;
  readonly activitiesLoaded: boolean;
  readonly activityLoadError: string | null;
  readonly activityRegistryCount: number;
  readonly compiledActivityCount: number;
  readonly currentContextId: string | null;
  readonly contexts: readonly GameplayGraphDebugContext[];
  readonly actionsByContextId: Readonly<Record<string, readonly GameplayGraphDebugAction[]>>;
  readonly activities: readonly GameplayGraphDebugActivity[];
  readonly diagnostics: CompileResult["diagnostics"];
};

@Injectable({ providedIn: "root" })
export class GameplayGraphRuntime {
  private readonly roster = inject(CharacterRosterService);
  private readonly worldState = inject(WorldStateService);
  private readonly activitiesLoader = inject(ActivitiesLoader);
  private readonly triggerRunner = inject(GameplayTriggerRunner);
  private readonly debugLog = inject(DebugLogService);

  private readonly activitiesState = signal<readonly GameActivityDefinition[]>([]);
  private readonly activitiesLoadedState = signal(false);
  private readonly activityLoadErrorState = signal<string | null>(null);

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

  readonly debugSnapshot = computed<GameplayGraphDebugSnapshot | null>(() => {
    const compiled = this.compiledResult();
    const graph = compiled?.graph;

    if (!graph) {
      return null;
    }

    const world = this.roster.activeWorld();
    const activeSlot = this.roster.activeSlot();
    const guardCatalog = this.worldState.worldGuardCatalog();
    const currentContextId = world
      ? buildContextId(world.currentLocation, world.sublocations.at(-1))
      : null;

    const contexts = Array.from(graph.contextsById.values())
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((context) => ({
        id: context.id,
        locationId: context.locationId,
        sublocationId: context.sublocationId,
        actionCount: context.actionIds.length,
        isCurrent: currentContextId === context.id
      }));

    const actionsByContextId: Record<string, readonly GameplayGraphDebugAction[]> = {};

    for (const context of contexts) {
      const graphContext = graph.contextsById.get(context.id);

      if (!graphContext) {
        actionsByContextId[context.id] = [];
        continue;
      }

      const guardContext: GuardContext | null =
        activeSlot
          ? {
              player: activeSlot.player,
              npcs: {},
              world: {
                currentLocation: context.locationId,
                sublocations: context.sublocationId ? [context.sublocationId] : []
              }
            }
          : null;

      const contextActions: GameplayGraphDebugAction[] = [];

      for (const actionId of graphContext.actionIds) {
        const action = graph.actionsById.get(actionId);

        if (!action) {
          continue;
        }

        const visibleResult =
          guardContext && guardCatalog
            ? evaluateExecutionGuards(action.visibleWhen, guardContext, guardCatalog)
            : { passes: true };
        const enabledResult =
          guardContext && guardCatalog
            ? evaluateExecutionGuards(action.enabledWhen, guardContext, guardCatalog)
            : { passes: false, failureReason: "No active guard context." };

        contextActions.push({
          id: action.id,
          label: action.label,
          groupKind: action.groupKind,
          executionKind: action.execution.kind,
          visibleGuards: (action.visibleWhen ?? []).map((guard) => guard.type),
          enabledGuards: (action.enabledWhen ?? []).map((guard) => guard.type),
          isVisible: visibleResult.passes,
          isEnabled: enabledResult.passes,
          disabledReason: enabledResult.passes ? undefined : enabledResult.failureReason
        });
      }

      actionsByContextId[context.id] = contextActions;
    }

    const activities: GameplayGraphDebugActivity[] = this.activitiesState().map((activity) => {
      const authoredContextId = buildContextId(
        activity.location.locationId,
        activity.location.sublocationId
      );
      const compiledAction = graph.actionsById.get(buildActivityActionId(activity.id));
      const isCompiled =
        compiledAction !== undefined &&
        compiledAction.execution.kind === "activity";

      return {
        id: activity.id,
        authoredContextId,
        compiled: isCompiled,
        compiledContextId: isCompiled ? compiledAction.contextId : undefined
      };
    });

    const diagnostics = [...(compiled?.diagnostics ?? [])];

    if (!this.activitiesLoadedState()) {
      diagnostics.push({
        severity: "info",
        code: "GEG_I010",
        message: "Activity registry load is still pending.",
        source: { path: "activities-loader" }
      });
    } else if (this.activityLoadErrorState()) {
      diagnostics.push({
        severity: "error",
        code: "GEG_E010",
        message: `Activity registry failed to load: ${this.activityLoadErrorState()}`,
        source: { path: "activities-loader" }
      });
    } else if (activities.length === 0) {
      diagnostics.push({
        severity: "warning",
        code: "GEG_W010",
        message: "Activity registry loaded but returned zero activities.",
        source: { path: "activities-loader" }
      });
    } else if (activities.every((activity) => !activity.compiled)) {
      diagnostics.push({
        severity: "warning",
        code: "GEG_W011",
        message: "Activities loaded but none compiled into the execution graph.",
        source: { path: "graph-compiler" }
      });
    }

    return {
      graphVersion: graph.version,
      contextCount: graph.contextsById.size,
      actionCount: graph.actionsById.size,
      activitiesLoaded: this.activitiesLoadedState(),
      activityLoadError: this.activityLoadErrorState(),
      activityRegistryCount: activities.length,
      compiledActivityCount: activities.filter((entry) => entry.compiled).length,
      currentContextId,
      contexts,
      actionsByContextId,
      activities,
      diagnostics
    };
  });

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
          this.debugLog.logMessage("execution-graph", "Loaded activities for execution graph.", {
            activityCount: activities.length
          });
          this.activitiesState.set(activities);
          this.activitiesLoadedState.set(true);
          this.activityLoadErrorState.set(null);
        },
        error: (error: unknown) => {
          const message = normalizeErrorMessage(error);
          this.debugLog.logMessage("execution-graph", "Failed to load activities for execution graph.", {
            reason: message
          });
          this.activitiesState.set([]);
          this.activitiesLoadedState.set(true);
          this.activityLoadErrorState.set(message);
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

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown activity load failure.";
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
