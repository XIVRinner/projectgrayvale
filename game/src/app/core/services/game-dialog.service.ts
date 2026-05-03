import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import {
  type Delta,
  type DeltaValue,
  type Player,
  type Race
} from "@rinner/grayvale-core";
import {
  compile,
  Engine,
  type StepResult
} from "@rinner/grayvale-dialogue";
import { forkJoin } from "rxjs";

import { CharacterCreatorOptionsLoader } from "../../data/loaders/character-creator-options.loader";
import {
  DialogueActorsLoader,
  type DialogueActorDefinition
} from "../../data/loaders/dialogue-actors.loader";
import {
  GameDialogActorView,
  GameDialogChoiceView,
  GameDialogEvent,
  GameDialogSessionView,
  GameDialogTranscriptEntry
} from "../../shared/components/game-dialog/game-dialog.types";
import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
import { GameQuestService } from "./game-quest.service";
import { WorldStateService } from "./world-state.service";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class GameDialogService {
  private readonly http = inject(HttpClient);
  private readonly roster = inject(CharacterRosterService);
  private readonly creatorOptionsLoader = inject(CharacterCreatorOptionsLoader);
  private readonly dialogueActorsLoader = inject(DialogueActorsLoader);
  private readonly worldState = inject(WorldStateService);
  private readonly debugLog = inject(DebugLogService);
  private readonly gameQuests = inject(GameQuestService);

  private readonly sessionState = signal<GameDialogSessionView | null>(null);
  private readonly queuedDeltasState = signal<readonly Delta[]>([]);
  private readonly errorState = signal<string | null>(null);
  private readonly eventSubject = new Subject<GameDialogEvent>();

  private engine: Engine | null = null;
  private transcript: GameDialogTranscriptEntry[] = [];
  private transcriptCounter = 0;
  private actorsById = new Map<string, DialogueActorDefinition>();
  private sceneImagePath: string | null = null;
  private title = "Wake Up";
  private eyebrow: string | null = null;
  private subtitle: string | null = null;
  private seenChoiceLabels = new Set<string>();

  readonly session = this.sessionState.asReadonly();
  readonly queuedDeltas = this.queuedDeltasState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly events$ = this.eventSubject.asObservable();

  startPrologue(): void {
    if (this.engine !== null || this.sessionState() !== null) {
      this.debugLog.logMessage("dialogue", "Ignored prologue start because a dialogue session is already open.");
      return;
    }

    const activePlayer = this.roster.activeCharacter();

    if (!activePlayer) {
      this.debugLog.logMessage("dialogue", "Ignored prologue start because there is no active player.");
      return;
    }

    this.debugLog.logMessage("dialogue", "Starting prologue dialogue.", {
      playerId: activePlayer.id,
      playerName: activePlayer.name
    });

    const sublocation = this.worldState.currentSublocationMetadata();
    this.sceneImagePath = sublocation?.sceneImagePath ?? null;
    this.title = "Wake Up";
    this.eyebrow = sublocation?.label ?? "Prologue";
    this.subtitle = sublocation?.subtitle ?? "A hard-won return to consciousness.";
    this.errorState.set(null);
    this.transcript = [];
    this.transcriptCounter = 0;
    this.queuedDeltasState.set([]);

    forkJoin({
      source: this.http.get("assets/dialogue/prologue/valeflow-prologue.fsc", {
        responseType: "text"
      }),
      actors: this.dialogueActorsLoader.load(),
      options: this.creatorOptionsLoader.load()
    }).subscribe({
      next: ({ source, actors, options }) => {
        this.actorsById = new Map(actors.map((actor) => [actor.id, actor]));

        const raceById = new Map(options.races.map((race) => [race.id, race]));
        const engine = new Engine(compile(source));

        this.registerHooks(engine, activePlayer, raceById);
        this.engine = engine;
        this.debugLog.logMessage("dialogue", "Prologue dialogue compiled and initialized.", {
          actorCount: actors.length,
          raceOptionCount: options.races.length
        });
        this.eventSubject.next({
          type: "session-started",
          mode: "valeflow",
          title: this.title,
          eyebrow: this.eyebrow,
          subtitle: this.subtitle
        });
        this.consumeNextStep();
      },
      error: (error: unknown) => {
        this.resetRuntime();
        this.debugLog.logMessage("dialogue", "Failed to start prologue dialogue.", toErrorMessage(error, "Unknown dialogue load error."));
        this.errorState.set(toErrorMessage(error, "Failed to load prologue dialogue."));
      }
    });
  }

  advance(): void {
    const session = this.sessionState();

    if (!this.engine || !session || session.isAwaitingChoice || !session.canAdvance) {
      this.debugLog.logMessage("dialogue", "Ignored advance request.", {
        hasEngine: this.engine !== null,
        hasSession: session !== null,
        isAwaitingChoice: session?.isAwaitingChoice ?? false,
        canAdvance: session?.canAdvance ?? false
      });
      return;
    }

    this.debugLog.logMessage("dialogue", "Advancing dialogue.");
    this.consumeNextStep();
  }

  choose(index: number): void {
    const session = this.sessionState();

    if (!this.engine || !session || !session.isAwaitingChoice) {
      this.debugLog.logMessage("dialogue", "Ignored choice selection.", {
        index,
        hasEngine: this.engine !== null,
        hasSession: session !== null,
        isAwaitingChoice: session?.isAwaitingChoice ?? false
      });
      return;
    }

    const chosen = session.choices.find((c) => c.index === index);
    if (chosen) {
      this.seenChoiceLabels.add(chosen.label);
      this.debugLog.logMessage("dialogue", "Dialogue choice selected.", chosen);
      this.eventSubject.next({
        type: "choice-selected",
        choice: chosen
      });
    }

    this.engine.choose(index);
    this.consumeNextStep();
  }

  private registerHooks(
    engine: Engine,
    player: Player,
    raceById: ReadonlyMap<string, Race>
  ): void {
    engine.registerFunction("Actor", (_ctx, id) => {
      const actorId = ensureNonEmptyString(id, "Actor id");
      const actor = this.actorsById.get(actorId);

      if (!actor) {
        throw new Error(`Dialogue actor "${actorId}" is not defined.`);
      }

      return {
        id: actor.id,
        name: actor.name,
        title: actor.title,
        portraitPath: actor.portraitPath
      } satisfies GameDialogActorView;
    });

    engine.registerFunction("Player", (_ctx) => {
      const raceName = raceById.get(player.raceId)?.name ?? player.raceId;
      const baseActor = this.actorsById.get("player");

      return {
        id: "player",
        name: player.name,
        title: baseActor?.title,
        portraitPath: resolvePlayerPortraitPath(player, raceById.get(player.raceId)) ?? baseActor?.portraitPath,
        raceId: player.raceId,
        raceName
      };
    });

    engine.registerFunction("ApplyPlayerSet", (_ctx, path, value) => {
      const dotPath = ensureNonEmptyString(path, "ApplyPlayerSet path");
      const delta = buildPlayerSetDelta(dotPath, value);

      this.debugLog.logMessage("dialogue", "Dispatching scripted player delta.", {
        path: dotPath,
        value
      });
      this.queuedDeltasState.update((deltas) => [...deltas, delta]);
      const applied = this.roster.applyActiveCharacterDeltas([delta]) !== null;

      this.debugLog.logMessage(
        "dialogue",
        applied
          ? "Applied scripted player delta immediately."
          : "Failed to apply scripted player delta immediately.",
        {
          path: dotPath,
          value
        }
      );
      return null;
    });

    engine.registerFunction("startQuestById", (_ctx, id) => {
      const questId = ensureNonEmptyString(id, "startQuestById questId");

      this.debugLog.logMessage("dialogue", "Dialogue requested quest start.", { questId });
      this.gameQuests.startQuestById(questId);
      return null;
    });
  }

  private consumeNextStep(): void {
    if (!this.engine) {
      return;
    }

    const step = this.engine.next();

    if (step.type === "end") {
      this.debugLog.logMessage("dialogue", "Dialogue reached end step.");
      this.completeSession();
      return;
    }

    if (step.type === "choice") {
      const choices = step.options.map((option) => ({
        index: option.index,
        label: option.label,
        seen: this.seenChoiceLabels.has(option.label)
      }));

      this.debugLog.logMessage("dialogue", "Presenting dialogue choices.", choices);
      this.eventSubject.next({
        type: "choices-presented",
        choices
      });
      this.sessionState.set(
        buildSessionView({
          title: this.title,
          eyebrow: this.eyebrow,
          subtitle: this.subtitle,
          sceneImagePath: this.sceneImagePath,
          transcript: this.transcript,
          choices
        })
      );
      return;
    }

    const entry = this.toTranscriptEntry(step);
    this.transcript = [...this.transcript, entry];
    this.debugLog.logMessage("dialogue", "Rendered dialogue line.", entry);
    this.eventSubject.next({
      type: "line-shown",
      entry
    });
    this.sessionState.set(
      buildSessionView({
        title: this.title,
        eyebrow: this.eyebrow,
        subtitle: this.subtitle,
        sceneImagePath: this.sceneImagePath,
        transcript: this.transcript,
        choices: []
      })
    );
  }

  private toTranscriptEntry(
    step: Extract<StepResult, { type: "say" | "narration" }>
  ): GameDialogTranscriptEntry {
    if (step.type === "narration") {
      return {
        id: buildTranscriptId(++this.transcriptCounter),
        kind: "narration",
        actor: null,
        text: step.text
      };
    }

    return {
      id: buildTranscriptId(++this.transcriptCounter),
      kind: "say",
      actor: normalizeActor(step.actor),
      text: step.text
    };
  }

  private completeSession(): void {
    const deltas = [...this.queuedDeltasState()];

    this.debugLog.logMessage("dialogue", "Closing dialogue session.", {
      appliedDeltaCount: deltas.length
    });
    this.eventSubject.next({
      type: "session-ended",
      appliedDeltaCount: deltas.length
    });

    this.resetRuntime();
  }

  private resetRuntime(): void {
    this.debugLog.logMessage("dialogue", "Resetting dialogue runtime state.");
    this.engine = null;
    this.transcript = [];
    this.transcriptCounter = 0;
    this.actorsById = new Map();
    this.sceneImagePath = null;
    this.seenChoiceLabels = new Set();
    this.sessionState.set(null);
  }
}

function buildSessionView(options: {
  title: string;
  eyebrow: string | null;
  subtitle: string | null;
  sceneImagePath: string | null;
  transcript: readonly GameDialogTranscriptEntry[];
  choices: readonly GameDialogChoiceView[];
}): GameDialogSessionView {
  return {
    mode: "valeflow",
    title: options.title,
    eyebrow: options.eyebrow,
    subtitle: options.subtitle,
    sceneImagePath: options.sceneImagePath,
    transcript: options.transcript,
    currentEntry: options.transcript.at(-1) ?? null,
    choices: options.choices,
    canAdvance: options.choices.length === 0 && options.transcript.length > 0,
    isAwaitingChoice: options.choices.length > 0
  };
}

function buildTranscriptId(counter: number): string {
  return `dialog-line-${counter}`;
}

function normalizeActor(raw: unknown): GameDialogActorView | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const actor = raw as Record<string, unknown>;
  const id = typeof actor["id"] === "string" ? actor["id"] : "actor";
  const name =
    typeof actor["name"] === "string" && actor["name"].trim().length > 0
      ? actor["name"]
      : "Unknown Speaker";

  return {
    id,
    name,
    title: typeof actor["title"] === "string" ? actor["title"] : undefined,
    portraitPath:
      typeof actor["portraitPath"] === "string" ? actor["portraitPath"] : undefined
  };
}

function resolvePlayerPortraitPath(
  player: Player,
  race: Race | undefined
): string | null {
  if (!race?.imageBasePath || !player.selectedAppearance) {
    return null;
  }

  const portraitName =
    race.variants?.[player.selectedAppearance.variant]?.[player.selectedAppearance.imageIndex];

  if (!portraitName) {
    return null;
  }

  return `${race.imageBasePath}/${player.selectedAppearance.variant}/${portraitName}`;
}

function ensureNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function buildPlayerSetDelta(path: string, value: unknown): Delta {
  return {
    type: "set",
    target: "player",
    path: path.split("."),
    value: toDeltaValue(value)
  };
}

function toDeltaValue(value: unknown): DeltaValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toDeltaValue(entry));
  }

  if (typeof value === "object") {
    const nextValue: Record<string, DeltaValue> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      nextValue[key] = toDeltaValue(entry);
    }

    return nextValue;
  }

  throw new Error(`Unsupported delta value type: ${typeof value}.`);
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
