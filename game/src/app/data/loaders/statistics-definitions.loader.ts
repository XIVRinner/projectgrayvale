import { Injectable, inject } from "@angular/core";
import {
  type StatisticsDefinition,
  statisticsDefinitionCatalogSchema
} from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

@Injectable({ providedIn: "root" })
export class StatisticsDefinitionsLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly StatisticsDefinition[]> {
    return this.apiCache.getJsonWithFallback<unknown>(
      [apiPath("progression/statistics-definitions"), dataApiPath("progression/statistics-definitions")],
      { cacheKey: apiPath("progression/statistics-definitions") }
    ).pipe(
      map((raw) => statisticsDefinitionCatalogSchema.parse(raw))
    );
  }
}
