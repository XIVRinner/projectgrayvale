import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import {
  type ExperienceConfig,
  type PlayerDifficultyMode,
  experienceConfigSetSchema
} from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

export type GameDifficultyCurves = Readonly<Record<PlayerDifficultyMode, ExperienceConfig>>;

@Injectable({ providedIn: "root" })
export class DifficultyCurvesLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<GameDifficultyCurves> {
    return this.http.get<unknown>("assets/data/progression/difficulty-curves.json").pipe(
      map((raw) => parseDifficultyCurves(raw))
    );
  }
}

function parseDifficultyCurves(raw: unknown): GameDifficultyCurves {
  const parsed = experienceConfigSetSchema.parse(raw);
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
