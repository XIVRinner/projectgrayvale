import { Injectable, inject } from "@angular/core";
import {
  achievementDefinitionCatalogSchema,
  type AchievementDefinition
} from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

@Injectable({ providedIn: "root" })
export class AchievementDefinitionsLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly AchievementDefinition[]> {
    return this.apiCache.getJsonWithFallback<unknown>(
      [apiPath("progression/achievement-definitions"), dataApiPath("progression/achievement-definitions")],
      { cacheKey: apiPath("progression/achievement-definitions") }
    ).pipe(
      map((raw) => achievementDefinitionCatalogSchema.parse(raw))
    );
  }
}
