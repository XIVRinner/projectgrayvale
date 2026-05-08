import { Component, computed, input, output, signal } from "@angular/core";

import type { DebugLogEntry } from "../../../core/services/game-log/debug-log.service";
import type { GameLogEntry } from "../../../core/services/game-log/log-mapper";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";
import {
  type GameLogFeedFilter,
  type GameLogSection,
  ShellGameplayLogFilterBarComponent
} from "./shell-gameplay-log-filter-bar.component";
import { ShellGameplayLogFeedListComponent } from "./shell-gameplay-log-feed-list.component";
import { ShellGameplayLogTraceListComponent } from "./shell-gameplay-log-trace-list.component";

@Component({
  selector: "gv-shell-gameplay-log-dialog",
  standalone: true,
  imports: [
    DialogShellComponent,
    ShellGameplayLogFilterBarComponent,
    ShellGameplayLogFeedListComponent,
    ShellGameplayLogTraceListComponent
  ],
  templateUrl: "./shell-gameplay-log-dialog.component.html",
  styleUrl: "./shell-gameplay-log-dialog.component.scss"
})
export class ShellGameplayLogDialogComponent {
  readonly open = input.required<boolean>();
  readonly entries = input.required<readonly GameLogEntry[]>();
  readonly debugEntries = input.required<readonly DebugLogEntry[]>();

  readonly closed = output<void>();

  protected readonly activeSection = signal<GameLogSection>("all");
  protected readonly activeFeedFilter = signal<GameLogFeedFilter>("all");
  protected readonly activeTraceScope = signal<string>("all");

  protected readonly hasAnyData = computed(
    () => this.entries().length > 0 || this.debugEntries().length > 0
  );

  protected readonly isFeedActive = computed(() => {
    const s = this.activeSection();
    return s === "all" || s === "feed";
  });

  protected readonly isTraceActive = computed(() => {
    const s = this.activeSection();
    return s === "all" || s === "trace";
  });

  protected readonly filteredFeedEntries = computed(() => {
    const filter = this.activeFeedFilter();
    const entries = this.entries();
    return filter === "all" ? entries : entries.filter((e) => e.type === filter);
  });

  protected readonly filteredTraceEntries = computed(() => {
    const scope = this.activeTraceScope();
    const entries = this.debugEntries();
    return scope === "all" ? entries : entries.filter((e) => e.scope === scope);
  });

  protected readonly availableScopes = computed(() => {
    const scopes = new Set(this.debugEntries().map((e) => e.scope));
    return ["all", ...Array.from(scopes).sort()];
  });
}

