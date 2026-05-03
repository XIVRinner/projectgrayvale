import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import {
  activityDefinitionSchema
} from "@rinner/grayvale-core";
import { map, type Observable } from "rxjs";

import {
  type GameActivityDefinition,
  type GameActivityLocation
} from "./game-activity.types";

@Injectable({ providedIn: "root" })
export class ActivitiesLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly GameActivityDefinition[]> {
    return this.http.get<unknown>("assets/data/activities.json").pipe(
      map((raw) => parseActivities(raw))
    );
  }
}

function parseActivities(raw: unknown): readonly GameActivityDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("activities.json must be an array.");
  }

  return raw.map((entry, index) => {
    const location = parseLocation(entry, index);
    // Strip the game-layer `location` field before passing to the core Zod schema,
    // which does not know about game-layer extensions.
    const { location: _stripped, ...coreEntry } = entry as Record<string, unknown>;
    const base = activityDefinitionSchema.parse(coreEntry);
    return { ...base, location } satisfies GameActivityDefinition;
  });
}

function parseLocation(entry: unknown, index: number): GameActivityLocation {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`activities.json[${index}] must be an object.`);
  }

  const record = entry as Record<string, unknown>;
  const loc = record["location"];

  if (typeof loc !== "object" || loc === null) {
    throw new Error(`activities.json[${index}].location must be an object.`);
  }

  const locRecord = loc as Record<string, unknown>;
  const locationId = locRecord["locationId"];
  const sublocationId = locRecord["sublocationId"];

  if (typeof locationId !== "string" || locationId.trim().length === 0) {
    throw new Error(`activities.json[${index}].location.locationId must be a non-empty string.`);
  }

  if (sublocationId !== undefined && typeof sublocationId !== "string") {
    throw new Error(`activities.json[${index}].location.sublocationId must be a string.`);
  }

  return {
    locationId,
    sublocationId: typeof sublocationId === "string" ? sublocationId : undefined
  };
}

