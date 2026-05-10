import { Injectable, inject } from "@angular/core";
import {
  type ExperienceConfig,
  type PlayerDifficultyMode,
  experienceConfigSetSchema
} from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

export type GameDifficultyCurves = Readonly<Record<PlayerDifficultyMode, ExperienceConfig>>;

@Injectable({ providedIn: "root" })
export class DifficultyCurvesLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<GameDifficultyCurves> {
    return this.apiCache
      .getJsonWithFallback<unknown>(
        [apiPath("difficulty-curves"), dataApiPath("progression/difficulty-curves")],
        { cacheKey: apiPath("difficulty-curves") }
      )
      .pipe(map((raw) => parseDifficultyCurves(raw)));
  }
}

function parseDifficultyCurves(raw: unknown): GameDifficultyCurves {
  if (!Array.isArray(raw)) {
    const parsed = experienceConfigSetSchema.parse(raw);
    return normalizeDifficultyCurves(parsed);
  }

  const curves = ensureArray(raw, "difficulty-curves");
  const parsed = experienceConfigSetSchema.parse(
    Object.fromEntries(
      curves.map((entry, index) => {
        const record = ensureRecord(entry, `difficulty-curves[${index}]`);
        const id = ensureString(record["id"], `difficulty-curves[${index}].id`);
        const { id: _id, ...curve } = record;
        return [id, curve];
      })
    )
  );
  return normalizeDifficultyCurves(parsed);
}

function normalizeDifficultyCurves(
  parsed: Record<string, ExperienceConfig>
): GameDifficultyCurves {
  const easy = parsed["easy"];
  const normal = parsed["normal"];
  const hard = parsed["hard"];

  if (!easy || !normal || !hard) {
    throw new Error("difficulty-curves.json must define easy, normal, and hard curves.");
  }

  return {
    easy,
    normal,
    hard
  };
}

function ensureArray(raw: unknown, label: string): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw;
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
