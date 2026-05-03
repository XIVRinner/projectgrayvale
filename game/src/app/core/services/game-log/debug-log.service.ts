import { Injectable, inject } from "@angular/core";
import type { Delta } from "@rinner/grayvale-core";
import { BehaviorSubject, type Observable } from "rxjs";

import {
  CharacterRosterService,
  type WorldUpdateEvent
} from "../character-roster.service";

export interface DebugLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly scope: string;
  readonly message: string;
  readonly details?: string;
}

const MAX_DEBUG_LOG_ENTRIES = 400;

@Injectable({ providedIn: "root" })
export class DebugLogService {
  private readonly roster = inject(CharacterRosterService);
  private readonly rawLogSubject = new BehaviorSubject<Delta[]>([]);
  private readonly entryLogSubject = new BehaviorSubject<DebugLogEntry[]>([]);
  private entryCounter = 0;

  readonly log$: Observable<Delta[]> = this.rawLogSubject.asObservable();
  readonly entries$: Observable<DebugLogEntry[]> = this.entryLogSubject.asObservable();

  constructor() {
    this.roster.deltaApplied$.subscribe((delta) => {
      this.logRaw(delta);
    });
    this.roster.worldUpdated$.subscribe((event) => {
      this.logMessage(
        "world",
        "World state updated.",
        summarizeWorldUpdate(event)
      );
    });
  }

  logRaw(delta: Delta): void {
    this.rawLogSubject.next([...this.rawLogSubject.value, delta]);
    this.pushEntry({
      scope: "delta",
      message: summarizeDelta(delta),
      details: safeSerialize(delta)
    });
  }

  logMessage(scope: string, message: string, details?: unknown): void {
    this.pushEntry({
      scope,
      message,
      details: formatDetails(details)
    });
  }

  private pushEntry(entry: Omit<DebugLogEntry, "id" | "timestamp">): void {
    const nextEntry: DebugLogEntry = {
      id: `debug-${++this.entryCounter}`,
      timestamp: new Date().toISOString(),
      scope: entry.scope,
      message: entry.message,
      details: entry.details
    };

    const nextEntries = [...this.entryLogSubject.value, nextEntry];
    this.entryLogSubject.next(nextEntries.slice(-MAX_DEBUG_LOG_ENTRIES));
  }
}

function summarizeDelta(delta: Delta): string {
  const targetPrefix =
    delta.target === "npc" && delta.targetId
      ? `${delta.target}.${delta.targetId}`
      : delta.target;

  return `${delta.type.toUpperCase()} ${targetPrefix}.${delta.path.join(".")}`;
}

function summarizeWorldUpdate(event: WorldUpdateEvent): string {
  return [
    `from ${event.previousWorld.currentLocation}`,
    event.previousWorld.sublocations.length > 0
      ? `(${event.previousWorld.sublocations.join(" / ")})`
      : null,
    "to",
    event.nextWorld.currentLocation,
    event.nextWorld.sublocations.length > 0
      ? `(${event.nextWorld.sublocations.join(" / ")})`
      : null
  ]
    .filter((segment) => segment !== null)
    .join(" ");
}

function formatDetails(details: unknown): string | undefined {
  if (details === undefined) {
    return undefined;
  }

  if (typeof details === "string") {
    return details;
  }

  return safeSerialize(details);
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
