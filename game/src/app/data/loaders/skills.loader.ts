import { Injectable, inject } from "@angular/core";
import { type Skill, skillSchema } from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

@Injectable({ providedIn: "root" })
export class SkillsLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly Skill[]> {
    return this.apiCache.getJsonWithFallback<unknown>(
      [apiPath("skills"), dataApiPath("skills")],
      { cacheKey: apiPath("skills") }
    ).pipe(
      map((raw) => parseSkills(raw))
    );
  }
}

function parseSkills(raw: unknown): readonly Skill[] {
  if (!Array.isArray(raw)) {
    throw new Error("skills.json must be an array.");
  }

  return raw.map((entry) => skillSchema.parse(entry));
}
