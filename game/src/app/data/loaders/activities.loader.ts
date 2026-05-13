import { Injectable, inject } from "@angular/core";
import {
  type ActivityReward,
  activityDefinitionSchema
} from "@rinner/grayvale-core";
import { map, type Observable } from "rxjs";

import { apiPath, dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";
import {
  type GameActivityDefinition,
  type GameActivityLocation,
  type GameActivityQuestSignal
} from "./game-activity.types";

@Injectable({ providedIn: "root" })
export class ActivitiesLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly GameActivityDefinition[]> {
    return this.apiCache.getJsonWithFallback<unknown>(
      [apiPath("activity-definitions"), dataApiPath("activities")],
      { cacheKey: apiPath("activity-definitions") }
    ).pipe(
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
    const questSignal = parseQuestSignal(entry, index);
    const rewards = parseRewards(entry, index);
    // Strip the game-layer `location` field before passing to the core Zod schema,
    // which does not know about game-layer extensions. Rewards are also stripped
    // to keep compatibility with core schema variants that do not yet include them.
    const {
      location: _strippedLocation,
      questSignal: _strippedQuestSignal,
      rewards: _strippedRewards,
      ...coreEntry
    } = entry as Record<string, unknown>;
    const base = activityDefinitionSchema.parse(coreEntry);

    return {
      ...base,
      location,
      ...(questSignal ? { questSignal } : {}),
      ...(rewards ? { rewards } : {})
    } satisfies GameActivityDefinition;
  });
}

function parseQuestSignal(
  entry: unknown,
  index: number
): GameActivityQuestSignal | undefined {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`activities.json[${index}] must be an object.`);
  }

  const record = entry as Record<string, unknown>;
  const signal = record["questSignal"];

  if (signal === undefined) {
    return undefined;
  }

  if (typeof signal !== "object" || signal === null || Array.isArray(signal)) {
    throw new Error(`activities.json[${index}].questSignal must be an object.`);
  }

  const signalRecord = signal as Record<string, unknown>;

  if (signalRecord["type"] !== "kill") {
    throw new Error(`activities.json[${index}].questSignal.type must be "kill".`);
  }

  if (typeof signalRecord["target"] !== "string" || signalRecord["target"].trim().length === 0) {
    throw new Error(`activities.json[${index}].questSignal.target must be a non-empty string.`);
  }

  if (
    typeof signalRecord["count"] !== "number" ||
    !Number.isFinite(signalRecord["count"]) ||
    signalRecord["count"] < 1
  ) {
    throw new Error(`activities.json[${index}].questSignal.count must be a number >= 1.`);
  }

  return {
    type: "kill",
    target: signalRecord["target"],
    count: signalRecord["count"]
  };
}

function parseRewards(entry: unknown, index: number): ActivityReward[] | undefined {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`activities.json[${index}] must be an object.`);
  }

  const record = entry as Record<string, unknown>;
  const rewards = record["rewards"];

  if (rewards === undefined) {
    return undefined;
  }

  if (!Array.isArray(rewards)) {
    throw new Error(`activities.json[${index}].rewards must be an array when provided.`);
  }

  return rewards.map((reward, rewardIndex) => parseReward(reward, index, rewardIndex));
}

function parseReward(reward: unknown, activityIndex: number, rewardIndex: number): ActivityReward {
  if (typeof reward !== "object" || reward === null || Array.isArray(reward)) {
    throw new Error(
      `activities.json[${activityIndex}].rewards[${rewardIndex}] must be an object.`
    );
  }

  const record = reward as Record<string, unknown>;

  if (typeof record["type"] !== "string") {
    throw new Error(
      `activities.json[${activityIndex}].rewards[${rewardIndex}].type must be a string.`
    );
  }

  if (typeof record["value"] !== "object" || record["value"] === null) {
    throw new Error(
      `activities.json[${activityIndex}].rewards[${rewardIndex}].value must be an object.`
    );
  }

  return reward as ActivityReward;
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
