import { Injectable, inject } from "@angular/core";
import { actionDefinitionSchema } from "@rinner/grayvale-core";
import { map, type Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

export interface AuthoredActionDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly cost: {
    readonly type: "calculated";
    readonly base: number;
    readonly factors?: readonly {
      readonly source: "player_level" | "hp_missing" | "hp_max" | "base";
      readonly multiplier: number;
    }[];
  };
  readonly effect: {
    readonly type: "heal_full" | "heal_partial" | "restore_resource";
    readonly meta?: Readonly<Record<string, unknown>>;
  };
  readonly requirements?: {
    readonly minLevel?: number;
    readonly location?: string;
  };
}

@Injectable({ providedIn: "root" })
export class ActionsLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly AuthoredActionDefinition[]> {
    return this.apiCache
      .getJsonWithFallback<unknown>(
        [apiPath("actions"), dataApiPath("actions")],
        { cacheKey: apiPath("actions") },
      )
      .pipe(map((raw) => parseActions(raw)));
  }
}

function parseActions(raw: unknown): readonly AuthoredActionDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("actions.json must be an array.");
  }

  return raw.map(
    (entry) => actionDefinitionSchema.parse(entry) as AuthoredActionDefinition,
  );
}
