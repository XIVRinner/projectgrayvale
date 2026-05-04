import { Component, computed, effect, input, output, signal } from "@angular/core";

import {
  GameplayGraphDebugAction,
  GameplayGraphDebugContext,
  GameplayGraphDebugSnapshot
} from "../../../core/execution-graph/gameplay-graph-runtime.service";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-geg-visualizer-dialog",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-geg-visualizer-dialog.component.html",
  styleUrl: "./shell-geg-visualizer-dialog.component.scss"
})
export class ShellGegVisualizerDialogComponent {
  readonly open = input.required<boolean>();
  readonly snapshot = input<GameplayGraphDebugSnapshot | null>(null);
  protected readonly selectedContextId = signal<string | null>(null);

  protected readonly selectedContext = computed<GameplayGraphDebugContext | null>(() => {
    const graph = this.snapshot();
    const selectedContextId = this.selectedContextId();

    if (!graph || !selectedContextId) {
      return null;
    }

    return graph.contexts.find((context) => context.id === selectedContextId) ?? null;
  });

  protected readonly selectedContextActions = computed<readonly GameplayGraphDebugAction[]>(() => {
    const graph = this.snapshot();
    const selectedContextId = this.selectedContextId();

    if (!graph || !selectedContextId) {
      return [];
    }

    return graph.actionsByContextId[selectedContextId] ?? [];
  });

  readonly closed = output<void>();

  constructor() {
    effect(() => {
      const graph = this.snapshot();
      const selectedContextId = this.selectedContextId();

      if (!graph) {
        this.selectedContextId.set(null);
        return;
      }

      const contextIds = new Set(graph.contexts.map((context) => context.id));

      if (selectedContextId && contextIds.has(selectedContextId)) {
        return;
      }

      this.selectedContextId.set(graph.currentContextId ?? graph.contexts[0]?.id ?? null);
    });
  }

  protected selectContext(contextId: string): void {
    this.selectedContextId.set(contextId);
  }

  protected isSelectedContext(contextId: string): boolean {
    return this.selectedContextId() === contextId;
  }

  protected trackContext(_index: number, context: GameplayGraphDebugContext): string {
    return context.id;
  }

  protected trackAction(_index: number, action: GameplayGraphDebugAction): string {
    return action.id;
  }
}