import type { GraphDirtyReason } from "./gameplay-execution-graph.types";

/**
 * Tracks which kinds of data changes have occurred since the last graph
 * compilation. Consumers call `markDirty` when source data changes and
 * `shouldRecompile` to check whether a full recompile is warranted.
 *
 * State that only affects guard evaluation at runtime (e.g. inventory,
 * quest completion, story chapter) does NOT trigger a graph rebuild —
 * it triggers a projection refresh via Angular signal computation.
 */
export class GameplayGraphInvalidator {
  private readonly pendingReasons = new Set<GraphDirtyReason>();
  private compiled = false;

  markDirty(reason: GraphDirtyReason): void {
    this.pendingReasons.add(reason);
  }

  shouldRecompile(): boolean {
    return !this.compiled || this.pendingReasons.size > 0;
  }

  markClean(): void {
    this.pendingReasons.clear();
    this.compiled = true;
  }

  reasons(): readonly GraphDirtyReason[] {
    return [...this.pendingReasons];
  }
}
