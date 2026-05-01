import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { type Race, type RaceVariant } from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

import { parseRace } from "../../core/validation/core-runtime-validation";

export interface CharacterCreatorClassOption {
  readonly id: string;
  readonly name: string;
  readonly bonusSummary: string;
  readonly lore: string;
  readonly baseAttributes: Readonly<Record<string, number>>;
  readonly baseSkills: Readonly<Record<string, number>>;
  readonly iconPath: string;
}

export interface CharacterCreatorDefaults {
  readonly raceId: string;
  readonly classId: string;
  readonly appearanceVariant: RaceVariant;
  readonly appearanceIndex: number;
  readonly adventurerRank: number;
  readonly progression: {
    readonly level: number;
    readonly experience: number;
  };
}

export interface CharacterCreatorOptions {
  readonly races: readonly Race[];
  readonly classes: readonly CharacterCreatorClassOption[];
  readonly defaults: CharacterCreatorDefaults;
}

@Injectable({ providedIn: "root" })
export class CharacterCreatorOptionsLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<CharacterCreatorOptions> {
    return this.http.get<unknown>("assets/data/character-creator.json").pipe(
      map((raw) => parseCharacterCreatorOptions(raw))
    );
  }
}

function parseCharacterCreatorOptions(raw: unknown): CharacterCreatorOptions {
  const root = ensureRecord(raw, "character-creator root");
  const races = ensureArray(root["races"], "races").map((entry) => parseRace(entry));
  const classes = ensureArray(root["classes"], "classes").map((entry) => parseClass(entry));
  const defaults = parseDefaults(root["defaults"]);

  if (!races.some((race) => race.id === defaults.raceId)) {
    throw new Error("Default raceId is not present in character-creator races.");
  }

  if (!classes.some((value) => value.id === defaults.classId)) {
    throw new Error("Default classId is not present in character-creator classes.");
  }

  return { races, classes, defaults };
}

function parseClass(raw: unknown): CharacterCreatorClassOption {
  const record = ensureRecord(raw, "class option");

  return {
    id: ensureString(record["id"], "class.id"),
    name: ensureString(record["name"], "class.name"),
    bonusSummary: ensureString(record["bonusSummary"], "class.bonusSummary"),
    lore: ensureString(record["lore"], "class.lore"),
    baseAttributes: parseNumberMap(record["baseAttributes"], "class.baseAttributes"),
    baseSkills: parseSkillMap(record["baseSkills"], "class.baseSkills"),
    iconPath: ensureString(record["iconPath"], "class.iconPath")
  };
}

function parseDefaults(raw: unknown): CharacterCreatorDefaults {
  const record = ensureRecord(raw, "defaults");
  const progression = ensureRecord(record["progression"], "defaults.progression");
  const variant = ensureString(record["appearanceVariant"], "defaults.appearanceVariant");

  if (!isRaceVariant(variant)) {
    throw new Error("defaults.appearanceVariant must be warm, cool, or exotic.");
  }

  return {
    raceId: ensureString(record["raceId"], "defaults.raceId"),
    classId: ensureString(record["classId"], "defaults.classId"),
    appearanceVariant: variant,
    appearanceIndex: ensureNumber(record["appearanceIndex"], "defaults.appearanceIndex"),
    adventurerRank: ensureNumber(record["adventurerRank"], "defaults.adventurerRank"),
    progression: {
      level: ensureNumber(progression["level"], "defaults.progression.level"),
      experience: ensureNumber(progression["experience"], "defaults.progression.experience")
    }
  };
}

function isRaceVariant(value: string): value is RaceVariant {
  return value === "warm" || value === "cool" || value === "exotic";
}

function parseNumberMap(raw: unknown, label: string): Readonly<Record<string, number>> {
  const record = ensureRecord(raw, label);
  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(record)) {
    result[key] = ensureNumber(value, `${label}.${key}`);
  }

  return result;
}

function parseSkillMap(raw: unknown, label: string): Readonly<Record<string, number>> {
  if (Array.isArray(raw)) {
    const result: Record<string, number> = {};

    for (const [index, value] of raw.entries()) {
      result[ensureString(value, `${label}[${index}]`)] = 1;
    }

    return result;
  }

  return parseNumberMap(raw, label);
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureArray(raw: unknown, label: string): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function ensureNumber(raw: unknown, label: string): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    throw new Error(`${label} must be a number.`);
  }

  return raw;
}
