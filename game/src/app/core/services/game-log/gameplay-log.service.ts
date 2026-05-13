import { Injectable, inject } from "@angular/core";
import type { Delta } from "@rinner/grayvale-core";
import { BehaviorSubject, type Observable } from "rxjs";

const MAX_STORED_LOG_ENTRIES = 300;

import { CharacterRosterService, type WorldUpdateEvent } from "../character-roster.service";
import { GameDialogService } from "../game-dialog.service";
import { GameQuestService } from "../game-quest.service";
import {
  appendGameplayLogEntry,
  mapDialogEventToGameplayLogEntry,
  mapDeltaToGameplayLogEntry,
  mapQuestEventToGameplayLogEntry,
  mapWorldUpdateToGameplayLogEntry,
  toGameplayLogEntries,
  type GameLogEntry,
  type StoredGameplayLogEntry,
} from "./log-mapper";
import type { GameDialogEvent } from "../../../shared/components/game-dialog/game-dialog.types";
import type { GameQuestEvent } from "../game-quest.types";

@Injectable({ providedIn: "root" })
export class GameplayLogService {
  private readonly roster = inject(CharacterRosterService);
  private readonly gameDialog = inject(GameDialogService);
  private readonly gameQuests = inject(GameQuestService);
  private readonly logEntriesSubject = new BehaviorSubject<GameLogEntry[]>([]);

  private storedEntries: readonly StoredGameplayLogEntry[] = [];

  readonly log$: Observable<GameLogEntry[]> =
    this.logEntriesSubject.asObservable();

  constructor() {
    this.roster.deltaApplied$.subscribe((delta) => {
      this.processDelta(delta);
    });
    this.roster.worldUpdated$.subscribe((event) => {
      this.processWorldUpdate(event);
    });
    this.gameDialog.events$.subscribe((event) => {
      this.processDialogEvent(event);
    });
    this.gameQuests.events$.subscribe((event) => {
      this.processQuestEvent(event);
    });
  }

  processDelta(delta: Delta): void {
    const mappedEntry = mapDeltaToGameplayLogEntry(delta);

    if (!mappedEntry) {
      return;
    }

    this.appendEntry(mappedEntry);
  }

  processWorldUpdate(event: WorldUpdateEvent): void {
    const mappedEntry = mapWorldUpdateToGameplayLogEntry(event);

    if (!mappedEntry) {
      return;
    }

    this.appendEntry(mappedEntry);
  }

  processDialogEvent(event: GameDialogEvent): void {
    const mappedEntry = mapDialogEventToGameplayLogEntry(event);

    if (!mappedEntry) {
      return;
    }

    this.appendEntry(mappedEntry);
  }

  processQuestEvent(event: GameQuestEvent): void {
    const mappedEntry = mapQuestEventToGameplayLogEntry(event);

    if (!mappedEntry) {
      return;
    }

    this.appendEntry(mappedEntry);
  }

  private appendEntry(entry: StoredGameplayLogEntry): void {
    let next = appendGameplayLogEntry(this.storedEntries, entry);
    if (next.length > MAX_STORED_LOG_ENTRIES) {
      next = next.slice(-MAX_STORED_LOG_ENTRIES);
    }
    this.storedEntries = next;
    this.logEntriesSubject.next(toGameplayLogEntries(this.storedEntries));
  }
}
