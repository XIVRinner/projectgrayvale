import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map, shareReplay, type Observable } from "rxjs";

export interface DialogueDefinition {
  readonly id: string;
  readonly entryFile: string;
  readonly title: string;
  readonly eyebrowFallback: string;
  readonly subtitleFallback: string;
}

@Injectable({ providedIn: "root" })
export class DialogueDefinitionsLoader {
  private readonly http = inject(HttpClient);

  private readonly definitions$ = this.http
    .get<unknown>("assets/data/dialogues.json")
    .pipe(
      map((raw) => parseDialogueDefinitions(raw)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  load(): Observable<readonly DialogueDefinition[]> {
    return this.definitions$;
  }
}

function parseDialogueDefinitions(raw: unknown): readonly DialogueDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("dialogues.json must be an array.");
  }

  const ids = new Set<string>();

  return raw.map((entry, index) => {
    const definition = parseDialogueDefinition(entry, `dialogues[${index}]`);

    if (ids.has(definition.id)) {
      throw new Error(`dialogues.json contains duplicate id "${definition.id}".`);
    }

    ids.add(definition.id);
    return definition;
  });
}

function parseDialogueDefinition(raw: unknown, label: string): DialogueDefinition {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    entryFile: ensureString(record["entryFile"], `${label}.entryFile`),
    title: ensureString(record["title"], `${label}.title`),
    eyebrowFallback: ensureString(record["eyebrowFallback"], `${label}.eyebrowFallback`),
    subtitleFallback: ensureString(record["subtitleFallback"], `${label}.subtitleFallback`)
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
