import { Injectable, inject } from "@angular/core";
import {
  type NotificationPolicy,
  notificationPolicyCatalogSchema
} from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

@Injectable({ providedIn: "root" })
export class NotificationPolicyLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly NotificationPolicy[]> {
    return this.apiCache.getJsonWithFallback<unknown>(
      [apiPath("notifications/notification-policies"), dataApiPath("notifications/notification-policies")],
      { cacheKey: apiPath("notifications/notification-policies") }
    ).pipe(
      map((raw) => notificationPolicyCatalogSchema.parse(raw))
    );
  }
}
