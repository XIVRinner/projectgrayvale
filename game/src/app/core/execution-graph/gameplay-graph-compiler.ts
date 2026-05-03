import type { WorldGraph } from "@rinner/grayvale-worldgraph";

import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import type { WorldGuardCatalog } from "../../data/loaders/world-guards.loader";
import type { WorldLocationsCatalog } from "../../data/loaders/world-locations.loader";
import { errorDiagnostic, warningDiagnostic } from "./gameplay-graph-diagnostics";
import type {
  ActionId,
  ActionNode,
  CompileDiagnostic,
  CompileResult,
  ContextId,
  ContextNode,
  GameplayExecutionGraph
} from "./gameplay-execution-graph.types";

// ---------------------------------------------------------------------------
// Compiler input
// ---------------------------------------------------------------------------

export type CompileInput = {
  readonly worldGraph: WorldGraph;
  readonly locationsCatalog: WorldLocationsCatalog;
  readonly guardCatalog: WorldGuardCatalog;
  readonly activities: readonly GameActivityDefinition[];
};

// ---------------------------------------------------------------------------
// Action IDs — kept identical to the legacy scheme so existing save data
// and gameplay log entries remain consistent.
// ---------------------------------------------------------------------------

export function buildEnterSublocationActionId(sublocationId: string): string {
  return `enter-${sublocationId}`;
}

export function buildExitSublocationActionId(sublocationId: string): string {
  return `leave-${sublocationId}`;
}

export function buildTravelActionId(from: string, to: string): string {
  return `travel-${from}-to-${to}`;
}

export function buildActivityActionId(activityId: string): string {
  return `activity:${activityId}`;
}

// ---------------------------------------------------------------------------
// Context ID helper
// ---------------------------------------------------------------------------

export function buildContextId(locationId: string, sublocationId?: string): ContextId {
  return sublocationId ? `${locationId}:${sublocationId}` : `${locationId}:default`;
}

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

let compileVersion = 0;

export function compileGameplayGraph(input: CompileInput): CompileResult {
  const diagnostics: CompileDiagnostic[] = [];
  const allActions: ActionNode[] = [];

  const knownGuardTypes = new Set(input.guardCatalog.guards.map((g) => g.type));

  // --- 1. Resolve location IDs from catalog and cross-check with the graph --

  const catalogLocationIds = new Set(input.locationsCatalog.locations.map((l) => l.id));

  for (const locationId of Object.keys(input.worldGraph.locations)) {
    if (!catalogLocationIds.has(locationId)) {
      diagnostics.push(
        warningDiagnostic(
          "GEG_W001",
          `Location "${locationId}" is in the world graph but has no metadata entry.`,
          { id: locationId }
        )
      );
    }
  }

  for (const location of input.locationsCatalog.locations) {
    if (!input.worldGraph.locations[location.id]) {
      diagnostics.push(
        errorDiagnostic(
          "GEG_E001",
          `Location "${location.id}" is in the location catalog but is missing from the world graph.`,
          { id: location.id }
        )
      );
    }
  }

  // --- 2. Build context nodes (one per location + one per sublocation) ------

  const contextMap = new Map<ContextId, ContextNode>();

  for (const location of input.locationsCatalog.locations) {
    const topLevelContextId = buildContextId(location.id);

    contextMap.set(topLevelContextId, {
      id: topLevelContextId,
      locationId: location.id,
      actionIds: []
    });

    for (const sublocation of location.sublocations) {
      const subContextId = buildContextId(location.id, sublocation.id);

      contextMap.set(subContextId, {
        id: subContextId,
        locationId: location.id,
        sublocationId: sublocation.id,
        actionIds: []
      });
    }
  }

  // --- 3. Generate sublocation movement actions ------------------------------

  for (const location of input.locationsCatalog.locations) {
    const topLevelContextId = buildContextId(location.id);

    for (const sublocation of location.sublocations) {
      const subContextId = buildContextId(location.id, sublocation.id);

      // Sublocation enter — visible at the parent location context
      const enterId = buildEnterSublocationActionId(sublocation.id);

      allActions.push({
        id: enterId,
        contextId: topLevelContextId,
        label: sublocation.entryActionLabel ?? `Enter ${sublocation.label}`,
        groupKind: "movement",
        hiddenByDefault: false,
        execution: {
          kind: "movement",
          movementKind: "sublocation-enter",
          targetSublocationId: sublocation.id
        },
        debug: { generated: true }
      });

      // Sublocation exit — visible only while inside the sublocation
      const exitId = buildExitSublocationActionId(sublocation.id);

      // Validate exit guard references
      for (const guard of sublocation.exitGuards ?? []) {
        if (!knownGuardTypes.has(guard.type)) {
          diagnostics.push(
            errorDiagnostic(
              "GEG_E002",
              `Sublocation "${sublocation.id}" exit guard references unknown guard type "${guard.type}".`,
              { id: sublocation.id, path: `${location.id}.sublocations.${sublocation.id}.exitGuards` }
            )
          );
        }
      }

      allActions.push({
        id: exitId,
        contextId: subContextId,
        label: sublocation.exitActionLabel ?? `Leave ${sublocation.label}`,
        groupKind: "movement",
        hiddenByDefault: false,
        enabledWhen: sublocation.exitGuards?.length ? [...sublocation.exitGuards] : undefined,
        execution: {
          kind: "movement",
          movementKind: "sublocation-exit",
          targetSublocationId: sublocation.id
        },
        debug: { generated: true }
      });
    }
  }

  // --- 4. Generate travel movement actions -----------------------------------

  for (const edge of input.worldGraph.edges) {
    const fromContextId = buildContextId(edge.from);

    // Validate the destination has metadata
    const destMeta = input.locationsCatalog.locations.find((l) => l.id === edge.to);

    if (!destMeta) {
      diagnostics.push(
        warningDiagnostic(
          "GEG_W002",
          `Travel edge from "${edge.from}" to "${edge.to}" has no destination metadata.`,
          { path: `edges.${edge.from}->${edge.to}` }
        )
      );
    }

    // Validate edge guard references
    for (const guard of edge.guards ?? []) {
      if (!knownGuardTypes.has(guard.type)) {
        diagnostics.push(
          errorDiagnostic(
            "GEG_E003",
            `Travel edge from "${edge.from}" to "${edge.to}" references unknown guard type "${guard.type}".`,
            { path: `edges.${edge.from}->${edge.to}.guards` }
          )
        );
      }
    }

    // Validate destination location guards
    const destGraphEntry = input.worldGraph.locations[edge.to];

    for (const guard of destGraphEntry?.guards ?? []) {
      if (!knownGuardTypes.has(guard.type)) {
        diagnostics.push(
          errorDiagnostic(
            "GEG_E004",
            `Location "${edge.to}" references unknown guard type "${guard.type}".`,
            { id: edge.to }
          )
        );
      }
    }

    if (!contextMap.has(fromContextId)) {
      diagnostics.push(
        errorDiagnostic(
          "GEG_E005",
          `Travel edge originates from unknown context "${fromContextId}".`,
          { path: `edges.${edge.from}->${edge.to}` }
        )
      );
      continue;
    }

    const travelId = buildTravelActionId(edge.from, edge.to);
    const label = `Travel to ${destMeta?.label ?? edge.to}`;

    // Travel is disabled (not invisible) when guards block it.
    // Both edge guards and destination location guards are modelled as enabledWhen.
    const enabledGuards = [
      ...(edge.guards ?? []),
      ...(destGraphEntry?.guards ?? [])
    ];

    allActions.push({
      id: travelId,
      contextId: fromContextId,
      label,
      groupKind: "travel",
      hiddenByDefault: false,
      enabledWhen: enabledGuards.length ? enabledGuards : undefined,
      execution: {
        kind: "movement",
        movementKind: "travel",
        targetLocationId: edge.to
      },
      debug: { generated: true }
    });
  }

  // --- 5. Generate activity actions ------------------------------------------

  for (const activity of input.activities) {
    const activityContextId = buildContextId(
      activity.location.locationId,
      activity.location.sublocationId
    );

    if (!contextMap.has(activityContextId)) {
      diagnostics.push(
        warningDiagnostic(
          "GEG_W003",
          `Activity "${activity.id}" references unknown context "${activityContextId}".`,
          { id: activity.id }
        )
      );
      continue;
    }

    allActions.push({
      id: buildActivityActionId(activity.id),
      contextId: activityContextId,
      label: activity.name,
      groupKind: "activity",
      hiddenByDefault: false,
      visibleWhen: [
        { type: "activity_available", params: { activityId: activity.id } }
      ],
      enabledWhen: [
        { type: "activity_enabled", params: { activityId: activity.id } }
      ],
      execution: {
        kind: "activity",
        activityId: activity.id
      },
      debug: { generated: false }
    });
  }

  // --- 6. Compile story/system actions (game-logic constants) ----------------

  allActions.push(...buildStoryActions(contextMap, diagnostics));

  // --- 7. Validate duplicate action IDs -------------------------------------

  const actionIdCounts = new Map<ActionId, number>();

  for (const action of allActions) {
    actionIdCounts.set(action.id, (actionIdCounts.get(action.id) ?? 0) + 1);
  }

  for (const [actionId, count] of actionIdCounts) {
    if (count > 1) {
      diagnostics.push(
        errorDiagnostic(
          "GEG_E006",
          `Duplicate action id "${actionId}" compiled ${count} times.`,
          { id: actionId }
        )
      );
    }
  }

  // --- 8. Build final maps --------------------------------------------------

  const actionsById = new Map<ActionId, ActionNode>();
  const actionsByContextId = new Map<ContextId, ActionId[]>();

  for (const action of allActions) {
    actionsById.set(action.id, action);

    const existing = actionsByContextId.get(action.contextId) ?? [];
    existing.push(action.id);
    actionsByContextId.set(action.contextId, existing);
  }

  // Attach action IDs into ContextNodes
  const finalContextMap = new Map<ContextId, ContextNode>();

  for (const [contextId, context] of contextMap) {
    finalContextMap.set(contextId, {
      ...context,
      actionIds: actionsByContextId.get(contextId) ?? []
    });
  }

  const graph: GameplayExecutionGraph = {
    version: ++compileVersion,
    contextsById: finalContextMap,
    actionsById,
    actionsByContextId: new Map(
      [...actionsByContextId.entries()].map(([k, v]) => [k, v as readonly ActionId[]])
    )
  };

  return { graph, diagnostics };
}

// ---------------------------------------------------------------------------
// Story action constants
// These are fixed game-logic actions that are not driven by JSON data files.
// ---------------------------------------------------------------------------

const STORY_WAKE_UP_ACTION_ID = "story:wake-up";
const STORY_WAKE_UP_CONTEXT_ID = "village-arkama:chief-house";

function buildStoryActions(
  contextMap: Map<ContextId, ContextNode>,
  diagnostics: CompileDiagnostic[]
): ActionNode[] {
  const actions: ActionNode[] = [];

  if (!contextMap.has(STORY_WAKE_UP_CONTEXT_ID)) {
    diagnostics.push(
      warningDiagnostic(
        "GEG_W004",
        `Story wake-up action context "${STORY_WAKE_UP_CONTEXT_ID}" does not exist. The prologue action will not be compiled.`,
        { id: STORY_WAKE_UP_ACTION_ID }
      )
    );

    return actions;
  }

  actions.push({
    id: STORY_WAKE_UP_ACTION_ID,
    contextId: STORY_WAKE_UP_CONTEXT_ID,
    label: "Wake up",
    groupKind: "talk",
    hiddenByDefault: false,
    visibleWhen: [{ type: "story_prologue_pending" }],
    execution: {
      kind: "dialogue",
      dialogueTarget: "prologue"
    }
  });

  return actions;
}
