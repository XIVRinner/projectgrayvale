import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import {
  activityDefinitionSchema,
  type ActivityDefinition
} from "@rinner/grayvale-core";
import { map, type Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class ActivitiesLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly ActivityDefinition[]> {
    return this.http.get<unknown>("assets/data/activities.json").pipe(
      map((raw) => parseActivities(raw))
    );
  }
}

function parseActivities(raw: unknown): readonly ActivityDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("activities.json must be an array.");
  }

  return raw.map((entry) => activityDefinitionSchema.parse(entry));
}
