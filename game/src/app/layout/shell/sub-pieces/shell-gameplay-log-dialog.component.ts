import { Component, computed, input, output } from "@angular/core";

import type { DebugLogEntry } from "../../../core/services/game-log/debug-log.service";
import type { GameLogEntry } from "../../../core/services/game-log/log-mapper";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-gameplay-log-dialog",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-gameplay-log-dialog.component.html",
  styleUrl: "./shell-gameplay-log-dialog.component.scss"
})
export class ShellGameplayLogDialogComponent {
  readonly open = input.required<boolean>();
  readonly entries = input.required<readonly GameLogEntry[]>();
  readonly debugEntries = input.required<readonly DebugLogEntry[]>();

  readonly closed = output<void>();

  protected readonly hasAnyData = computed(
    () => this.entries().length > 0 || this.debugEntries().length > 0
  );

  protected readonly consoleLines = computed(() => {
    const feedLines = this.entries().map((entry) => this.formatFeedLine(entry));
    const traceLines = this.debugEntries().map((entry) => this.formatTraceLine(entry));
    return [...feedLines, ...traceLines];
  });

  private formatFeedLine(entry: GameLogEntry): string {
    if (entry.type === "choice") {
      return `[FEED] INFO choice options=${toCompactJson(entry.options)}`;
    }

    return `[FEED] INFO ${entry.type} message=${toCompactJson(entry.text)}`;
  }

  private formatTraceLine(entry: DebugLogEntry): string {
    const time = formatIsoTime(entry.timestamp);
    const level = entry.level.toUpperCase();
    const details = entry.details ? ` payload=${toCompactJson(entry.details)}` : "";
    return `[${time}] ${level} ${entry.scope} ${entry.message}${details}`;
  }
}

function formatIsoTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(11, 23);
}

function toCompactJson(value: unknown): string {
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== null) {
      return JSON.stringify(parsed);
    }

    return JSON.stringify(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

