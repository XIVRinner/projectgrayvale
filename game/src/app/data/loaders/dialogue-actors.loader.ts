import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map, type Observable } from "rxjs";

export interface DialogueActorDefinition {
  readonly id: string;
  readonly name: string;
  readonly title?: string;
  readonly portraitPath?: string;
}

@Injectable({ providedIn: "root" })
export class DialogueActorsLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly DialogueActorDefinition[]> {
    return this.http.get<unknown>("assets/data/dialogue-actors.json").pipe(
      map((raw) => parseDialogueActors(raw))
    );
  }
}

function parseDialogueActors(raw: unknown): readonly DialogueActorDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("dialogue-actors.json must be an array.");
  }

  return raw.map((entry, index) => parseDialogueActor(entry, `dialogue-actors[${index}]`));
}

function parseDialogueActor(raw: unknown, label: string): DialogueActorDefinition {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    name: ensureString(record["name"], `${label}.name`),
    title: parseOptionalString(record["title"], `${label}.title`),
    portraitPath: parseOptionalString(record["portraitPath"], `${label}.portraitPath`)
  };
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function parseOptionalString(raw: unknown, label: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return ensureString(raw, label);
}
