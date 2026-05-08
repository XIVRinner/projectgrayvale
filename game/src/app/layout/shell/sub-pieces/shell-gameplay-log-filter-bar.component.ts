import { Component, computed, input, output } from "@angular/core";

import type { GameLogEntry } from "../../../core/services/game-log/log-mapper";

export type GameLogSection = "all" | "feed" | "trace";
export type GameLogFeedFilter = "all" | GameLogEntry["type"];

@Component({
  selector: "gv-shell-gameplay-log-filter-bar",
  standalone: true,
  templateUrl: "./shell-gameplay-log-filter-bar.component.html",
  styleUrl: "./shell-gameplay-log-filter-bar.component.scss"
})
export class ShellGameplayLogFilterBarComponent {
  readonly section = input.required<GameLogSection>();
  readonly feedFilter = input.required<GameLogFeedFilter>();
  readonly traceScope = input.required<string>();
  readonly availableScopes = input.required<readonly string[]>();

  readonly sectionChanged = output<GameLogSection>();
  readonly feedFilterChanged = output<GameLogFeedFilter>();
  readonly traceScopeChanged = output<string>();

  protected readonly showFeedFilter = computed(() => {
    const s = this.section();
    return s === "all" || s === "feed";
  });

  protected readonly showTraceFilter = computed(() => {
    const s = this.section();
    return s === "all" || s === "trace";
  });

  protected readonly sections: readonly { id: GameLogSection; label: string }[] = [
    { id: "all", label: "All" },
    { id: "feed", label: "Feed" },
    { id: "trace", label: "Trace" }
  ];

  protected readonly feedTypes: readonly { id: GameLogFeedFilter; label: string }[] = [
    { id: "all", label: "All types" },
    { id: "system", label: "System" },
    { id: "quest", label: "Quest" },
    { id: "combat", label: "Combat" },
    { id: "loot", label: "Loot" },
    { id: "dialogue", label: "Dialogue" },
    { id: "choice", label: "Choice" }
  ];

  protected onFeedFilterChange(event: Event): void {
    this.feedFilterChanged.emit((event.target as HTMLSelectElement).value as GameLogFeedFilter);
  }

  protected onTraceScopeChange(event: Event): void {
    this.traceScopeChanged.emit((event.target as HTMLSelectElement).value);
  }
}
