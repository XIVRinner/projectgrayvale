import type { Guard } from "@rinner/grayvale-worldgraph";

import type { ActionPanelGroupKind } from "../../shared/models/action-panel-group.model";

export type ContextId = string;
export type ActionId = string;

// ---------------------------------------------------------------------------
// Execution payloads
// ---------------------------------------------------------------------------

export type MovementExecution = {
  readonly kind: "movement";
  readonly movementKind: "travel" | "sublocation-enter" | "sublocation-exit";
  readonly targetLocationId?: string;
  readonly targetSublocationId?: string;
};

export type ActivityExecution = {
  readonly kind: "activity";
  readonly activityId: string;
};

export type DialogueExecution = {
  readonly kind: "dialogue";
  readonly dialogueTarget: string;
};

export type SystemExecution = {
  readonly kind: "system";
  readonly command: string;
};

export type ActionExecution =
  | MovementExecution
  | ActivityExecution
  | DialogueExecution
  | SystemExecution;

// ---------------------------------------------------------------------------
// Graph nodes
// ---------------------------------------------------------------------------

export type ActionNode = {
  readonly id: ActionId;
  readonly contextId: ContextId;
  readonly label: string;
  readonly groupKind: ActionPanelGroupKind;
  readonly visibleWhen?: readonly Guard[];
  readonly enabledWhen?: readonly Guard[];
  readonly hiddenByDefault: boolean;
  readonly disabledReason?: string;
  readonly execution: ActionExecution;
  readonly debug?: {
    readonly generated?: boolean;
    readonly sourceFile?: string;
  };
};

export type ContextNode = {
  readonly id: ContextId;
  readonly locationId: string;
  readonly sublocationId?: string;
  readonly actionIds: readonly ActionId[];
};

export type GameplayExecutionGraph = {
  readonly version: number;
  readonly contextsById: ReadonlyMap<ContextId, ContextNode>;
  readonly actionsById: ReadonlyMap<ActionId, ActionNode>;
  readonly actionsByContextId: ReadonlyMap<ContextId, readonly ActionId[]>;
};

// ---------------------------------------------------------------------------
// Runtime views
// ---------------------------------------------------------------------------

export type ActionView = {
  readonly id: ActionId;
  readonly label: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly disabledReason?: string;
  readonly groupKind: ActionPanelGroupKind;
};

export type ExecutionResult =
  | { readonly ok: true; readonly actionId: ActionId }
  | { readonly ok: false; readonly actionId: ActionId; readonly reason: string };

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

export type CompileDiagnostic = {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly source?: { readonly id?: string; readonly path?: string };
};

export type CompileResult = {
  readonly graph: GameplayExecutionGraph;
  readonly diagnostics: readonly CompileDiagnostic[];
};

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

export type GraphDirtyReason =
  | "world-graph-changed"
  | "location-data-changed"
  | "guard-data-changed"
  | "activity-registry-changed";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export type GameplayGraphLogEvent =
  | {
      readonly type: "action.executed";
      readonly actionId: ActionId;
      readonly contextId: ContextId;
      readonly executionKind: ActionExecution["kind"];
    }
  | {
      readonly type: "action.blocked";
      readonly actionId: ActionId;
      readonly contextId: ContextId;
      readonly reason: string;
    }
  | {
      readonly type: "graph.compiled";
      readonly version: number;
      readonly contextCount: number;
      readonly actionCount: number;
      readonly diagnosticCount: number;
    };
