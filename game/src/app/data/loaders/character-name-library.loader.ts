import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map, Observable } from "rxjs";

export type CharacterNameLibrary = Readonly<Record<string, readonly string[]>>;

@Injectable({ providedIn: "root" })
export class CharacterNameLibraryLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<CharacterNameLibrary> {
    return this.http.get<unknown>("assets/data/character-names.json").pipe(
      map((raw) => parseCharacterNameLibrary(raw))
    );
  }
}

function parseCharacterNameLibrary(raw: unknown): CharacterNameLibrary {
  const record = ensureRecord(raw, "character name library");
  const result: Record<string, readonly string[]> = {};

  for (const [raceSlug, value] of Object.entries(record)) {
    result[raceSlug] = ensureNameArray(value, `character name library.${raceSlug}`);
  }

  return result;
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureNameArray(raw: unknown, label: string): readonly string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string.`);
    }

    return entry.trim();
  });
}
