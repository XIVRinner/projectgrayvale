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

export function buildEnterSublocationActionId(
  sublocationId: string,
  locationId?: string
): string {
  if (locationId) {
    return `enter-${locationId}-${sublocationId}`;
  }

  return `enter-${sublocationId}`;
}

export function buildExitSublocationActionId(
  sublocationId: string,
  locationId?: string
): string {
  if (locationId) {
    return `leave-${locationId}-${sublocationId}`;
  }

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
  const sublocationLookup = new Map<string, { locationId: string; sublocationId: string }>();

  for (const location of input.locationsCatalog.locations) {
    const topLevelContextId = buildContextId(location.id);

    contextMap.set(topLevelContextId, {
      id: topLevelContextId,
      locationId: location.id,
      actionIds: []
    });

    for (const sublocation of location.sublocations) {
      const subContextId = buildContextId(location.id, sublocation.id);

      const existingSublocation = sublocationLookup.get(sublocation.id);
      if (!existingSublocation) {
        sublocationLookup.set(sublocation.id, {
          locationId: location.id,
          sublocationId: sublocation.id
        });
      } else if (existingSublocation.locationId !== location.id) {
        diagnostics.push(
          warningDiagnostic(
            "GEG_W007",
            `Sublocation id "${sublocation.id}" is duplicated across locations. Activity shorthand resolution for this id is disabled.`,
            { path: `world-locations.${location.id}.sublocations.${sublocation.id}` }
          )
        );
        sublocationLookup.delete(sublocation.id);
      }

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
      const enterId = buildEnterSublocationActionId(sublocation.id, location.id);

      // Validate entry guard references
      for (const guard of sublocation.entryGuards ?? []) {
        if (!knownGuardTypes.has(guard.type)) {
          diagnostics.push(
            errorDiagnostic(
              "GEG_E007",
              `Sublocation "${sublocation.id}" entry guard references unknown guard type "${guard.type}".`,
              { id: sublocation.id, path: `${location.id}.sublocations.${sublocation.id}.entryGuards` }
            )
          );
        }
      }

      allActions.push({
        id: enterId,
        contextId: topLevelContextId,
        label: sublocation.entryActionLabel ?? `Enter ${sublocation.label}`,
        groupKind: "movement",
        hiddenByDefault: false,
        disabledReason: sublocation.entryDisabledReason,
        visibleWhen: sublocation.entryGuards?.length ? [...sublocation.entryGuards] : undefined,
        execution: {
          kind: "movement",
          movementKind: "sublocation-enter",
          targetSublocationId: sublocation.id
        },
        debug: { generated: true }
      });

      // Sublocation exit — visible only while inside the sublocation
      const exitId = buildExitSublocationActionId(sublocation.id, location.id);

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
    const resolution = resolveActivityContextId(activity, contextMap, sublocationLookup);
    const authoredContextId = resolution.authoredContextId;
    const activityContextId = resolution.resolvedContextId;

    if (!contextMap.has(activityContextId)) {
      diagnostics.push(
        warningDiagnostic(
          "GEG_W003",
          `Activity "${activity.id}" references unknown context "${authoredContextId}".`,
          { id: activity.id }
        )
      );
      continue;
    }

    if (activityContextId !== authoredContextId) {
      diagnostics.push(
        warningDiagnostic(
          "GEG_W006",
          `Activity "${activity.id}" sublocation context "${authoredContextId}" was not found. Falling back to "${activityContextId}".`,
          { id: activity.id }
        )
      );
    }

    allActions.push({
      id: buildActivityActionId(activity.id),
      contextId: activityContextId,
      label: activity.name,
      groupKind: activity.questSignal?.type === "kill" ? "combat" : "activity",
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

  const seenActionIds = new Set<ActionId>();

  for (const action of allActions) {
    if (seenActionIds.has(action.id)) {
      // Keep the first compiled action for a duplicate id to avoid payload mismatch at runtime.
      continue;
    }

    seenActionIds.add(action.id);
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

function resolveActivityContextId(
  activity: GameActivityDefinition,
  contextMap: ReadonlyMap<ContextId, ContextNode>,
  sublocationLookup: ReadonlyMap<string, { locationId: string; sublocationId: string }>
): { authoredContextId: ContextId; resolvedContextId: ContextId } {
  const authoredContextId = buildContextId(
    activity.location.locationId,
    activity.location.sublocationId
  );

  if (contextMap.has(authoredContextId)) {
    return { authoredContextId, resolvedContextId: authoredContextId };
  }

  if (activity.location.sublocationId) {
    const locationContextId = buildContextId(activity.location.locationId);
    return { authoredContextId, resolvedContextId: locationContextId };
  }

  const shorthand = sublocationLookup.get(activity.location.locationId);
  if (shorthand) {
    const shorthandContextId = buildContextId(
      shorthand.locationId,
      shorthand.sublocationId
    );
    if (contextMap.has(shorthandContextId)) {
      return {
        authoredContextId,
        resolvedContextId: shorthandContextId
      };
    }
  }

  const locationContextId = buildContextId(activity.location.locationId);
  return { authoredContextId, resolvedContextId: locationContextId };
}

// ---------------------------------------------------------------------------
// Story action constants
// These are fixed game-logic actions that are not driven by JSON data files.
// ---------------------------------------------------------------------------

const STORY_WAKE_UP_ACTION_ID = "story:wake-up";
const STORY_WAKE_UP_CONTEXT_ID = "village-arkama:chief-house";

const STORY_CHIEF_LABOUR_ACTION_ID = "story:chief-labour";
const STORY_CHIEF_LABOUR_CONTEXT_ID = "village-arkama:chief-house";

const STORY_CHIEF_BRIDGITTE_HANDOFF_ACTION_ID = "story:chief-bridgitte-handoff";
const STORY_CHIEF_BRIDGITTE_HANDOFF_CONTEXT_ID = "village-arkama:default";

const STORY_BRIDGITTE_HOUSE_ACTION_ID = "story:bridgitte-house";
const STORY_BRIDGITTE_HOUSE_CONTEXT_ID = "village-arkama:bridgitte-house";
const STORY_BRIDGITTE_PRE_HUNT_REPEATABLES_ACTION_ID = "story:bridgitte-repeatables:pre-hunt";
const STORY_BRIDGITTE_PRE_HUNT_REPEATABLES_CONTEXT_ID = "village-arkama:bridgitte-house";
const STORY_BRIDGITTE_REPORT_BACK_ACTION_ID = "story:bridgitte-report-back";
const STORY_BRIDGITTE_REPORT_BACK_CONTEXT_ID = "village-arkama:bridgitte-house";
const STORY_BRIDGITTE_POST_COYOTE_REPEATABLES_ACTION_ID = "story:bridgitte-repeatables:post-coyote";
const STORY_BRIDGITTE_POST_COYOTE_REPEATABLES_CONTEXT_ID = "village-arkama:bridgitte-house";

const STORY_BARTENDER_INTRO_ACTION_ID = "story:bartender-intro";
const STORY_BARTENDER_INTRO_CONTEXT_ID = "village-arkama:tavern";

const STORY_SELF_TEND_INJURIES_ACTION_ID = "story:self-tend-injuries-unlock";
const STORY_SELF_TEND_INJURIES_CONTEXT_ID = "camp:default";

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

  if (!contextMap.has(STORY_CHIEF_LABOUR_CONTEXT_ID)) {
    diagnostics.push(
      warningDiagnostic(
        "GEG_W005",
        `Story chief-labour action context "${STORY_CHIEF_LABOUR_CONTEXT_ID}" does not exist. The chief labour action will not be compiled.`,
        { id: STORY_CHIEF_LABOUR_ACTION_ID }
      )
    );
  } else {
    actions.push({
      id: STORY_CHIEF_LABOUR_ACTION_ID,
      contextId: STORY_CHIEF_LABOUR_CONTEXT_ID,
      label: "Speak to the Chief",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [
        { type: "quest_completed", params: { questId: "quest_recovery" } },
        { type: "quest_not_started", params: { questId: "quest_chief_labour" } }
      ],
      execution: {
        kind: "dialogue",
        dialogueTarget: "chief-labour"
      }
    });
  }

  if (!contextMap.has(STORY_CHIEF_BRIDGITTE_HANDOFF_CONTEXT_ID)) {
    diagnostics.push(
      warningDiagnostic(
        "GEG_W007",
        `Story chief-bridgitte-handoff action context "${STORY_CHIEF_BRIDGITTE_HANDOFF_CONTEXT_ID}" does not exist. The chief follow-up action will not be compiled.`,
        { id: STORY_CHIEF_BRIDGITTE_HANDOFF_ACTION_ID }
      )
    );
  } else {
    actions.push({
      id: STORY_CHIEF_BRIDGITTE_HANDOFF_ACTION_ID,
      contextId: STORY_CHIEF_BRIDGITTE_HANDOFF_CONTEXT_ID,
      label: "Speak to the Chief",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [
        {
          type: "quest_step_active",
          params: { questId: "quest_chief_labour", stepId: "report_to_chief" }
        }
      ],
      execution: {
        kind: "dialogue",
        dialogueTarget: "chief-bridgitte-handoff"
      }
    });
  }

  if (!contextMap.has(STORY_BRIDGITTE_HOUSE_CONTEXT_ID)) {
    diagnostics.push(
      warningDiagnostic(
        "GEG_W008",
        `Story bridgitte-house action context "${STORY_BRIDGITTE_HOUSE_CONTEXT_ID}" does not exist. The Bridgitte intro action will not be compiled.`,
        { id: STORY_BRIDGITTE_HOUSE_ACTION_ID }
      )
    );
  } else {
    actions.push({
      id: STORY_BRIDGITTE_HOUSE_ACTION_ID,
      contextId: STORY_BRIDGITTE_HOUSE_CONTEXT_ID,
      label: "Speak to Bridgitte",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [
        { type: "quest_completed", params: { questId: "quest_chief_labour" } },
        { type: "quest_not_started", params: { questId: "cull_arkama_coyote" } }
      ],
      execution: {
        kind: "dialogue",
        dialogueTarget: "bridgitte-house"
      }
    });

    actions.push({
      id: STORY_BRIDGITTE_PRE_HUNT_REPEATABLES_ACTION_ID,
      contextId: STORY_BRIDGITTE_PRE_HUNT_REPEATABLES_CONTEXT_ID,
      label: "Speak to Bridgitte",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [
        {
          type: "quest_step_active",
          params: { questId: "cull_arkama_coyote", stepId: "cull_the_coyote" }
        }
      ],
      execution: {
        kind: "dialogue",
        dialogueTarget: "bridgitte-repeatables"
      }
    });

    actions.push({
      id: STORY_BRIDGITTE_REPORT_BACK_ACTION_ID,
      contextId: STORY_BRIDGITTE_REPORT_BACK_CONTEXT_ID,
      label: "Report to Bridgitte",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [
        {
          type: "quest_step_active",
          params: { questId: "cull_arkama_coyote", stepId: "report_back_to_bridgitte" }
        }
      ],
      execution: {
        kind: "dialogue",
        dialogueTarget: "bridgitte-report-back"
      }
    });

    actions.push({
      id: STORY_BRIDGITTE_POST_COYOTE_REPEATABLES_ACTION_ID,
      contextId: STORY_BRIDGITTE_POST_COYOTE_REPEATABLES_CONTEXT_ID,
      label: "Speak to Bridgitte",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [{ type: "quest_completed", params: { questId: "cull_arkama_coyote" } }],
      execution: {
        kind: "dialogue",
        dialogueTarget: "bridgitte-repeatables"
      }
    });
  }

  if (!contextMap.has(STORY_BARTENDER_INTRO_CONTEXT_ID)) {
    diagnostics.push(
      warningDiagnostic(
        "GEG_W009",
        `Story bartender-intro action context "${STORY_BARTENDER_INTRO_CONTEXT_ID}" does not exist. The bartender unlock action will not be compiled.`,
        { id: STORY_BARTENDER_INTRO_ACTION_ID }
      )
    );
  } else {
    actions.push({
      id: STORY_BARTENDER_INTRO_ACTION_ID,
      contextId: STORY_BARTENDER_INTRO_CONTEXT_ID,
      label: "Speak to Bartender",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [{ type: "activity_locked", params: { activityId: "tavern_work" } }],
      execution: {
        kind: "dialogue",
        dialogueTarget: "tavern-bartender-first-meeting"
      }
    });
  }

  if (!contextMap.has(STORY_SELF_TEND_INJURIES_CONTEXT_ID)) {
    diagnostics.push(
      warningDiagnostic(
        "GEG_W010",
        `Story self-tend-injuries action context "${STORY_SELF_TEND_INJURIES_CONTEXT_ID}" does not exist. The self-unlock action will not be compiled.`,
        { id: STORY_SELF_TEND_INJURIES_ACTION_ID }
      )
    );
  } else {
    actions.push({
      id: STORY_SELF_TEND_INJURIES_ACTION_ID,
      contextId: STORY_SELF_TEND_INJURIES_CONTEXT_ID,
      label: "Reflect on Your Wounds",
      groupKind: "talk",
      hiddenByDefault: false,
      visibleWhen: [{ type: "activity_locked", params: { activityId: "tend_injuries" } }],
      execution: {
        kind: "dialogue",
        dialogueTarget: "camp-self-tend-injuries"
      }
    });
  }

  return actions;
}
