import { Injectable, inject } from "@angular/core";
import { forkJoin, from, map, switchMap, type Observable } from "rxjs";
import type { Guard } from "@rinner/grayvale-worldgraph";

import { apiPath, dataApiPath } from "../api-paths";
import { DefinitionImageService } from "../definition-image.service";
import { GameApiCacheService } from "../game-api-cache.service";
import {
  cloneSaveSlotWorldState,
  type SaveSlotWorldState
} from "../../core/services/world-state.models";

export interface WorldSublocationMetadata {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly sceneImageId?: string;
  readonly sceneImagePath?: string;
  readonly availableNpcIds: readonly string[];
  readonly isReturnable: boolean;
  readonly entryActionLabel?: string;
  readonly exitActionLabel?: string;
  readonly entryDisabledReason?: string;
  readonly entryGuards?: readonly Guard[];
  readonly exitGuards?: readonly Guard[];
}

export interface WorldLocationMetadata {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly sceneImageId?: string;
  readonly sceneImagePath?: string;
  readonly availableNpcIds: readonly string[];
  readonly sublocations: readonly WorldSublocationMetadata[];
}

export interface WorldLocationsCatalog {
  readonly defaultState: SaveSlotWorldState;
  readonly locations: readonly WorldLocationMetadata[];
}

@Injectable({ providedIn: "root" })
export class WorldLocationsLoader {
  private readonly apiCache = inject(GameApiCacheService);
  private readonly definitionImageService = inject(DefinitionImageService);

  load(): Observable<WorldLocationsCatalog> {
    return forkJoin({
      defaultState: this.apiCache.getJsonWithFallback<unknown>(
        [apiPath("world-default-state/default"), dataApiPath("world-locations")],
        { cacheKey: apiPath("world-default-state/default") }
      ),
      locations: this.apiCache.getJsonWithFallback<unknown>(
        [apiPath("world-locations"), dataApiPath("world-locations")],
        { cacheKey: apiPath("world-locations") }
      )
    }).pipe(
      map(({ defaultState, locations }) => parseWorldLocationsCatalog(defaultState, locations)),
      switchMap((catalog) => from(this.resolveSceneImages(catalog)))
    );
  }

  private async resolveSceneImages(catalog: WorldLocationsCatalog): Promise<WorldLocationsCatalog> {
    return {
      ...catalog,
      locations: await Promise.all(
        catalog.locations.map(async (location) => ({
          ...location,
          sceneImagePath:
            location.sceneImageId
              ? await this.definitionImageService.getImageUrl("locations", location.sceneImageId)
              : location.sceneImagePath,
          sublocations: await Promise.all(
            location.sublocations.map(async (sublocation) => ({
              ...sublocation,
              sceneImagePath:
                sublocation.sceneImageId
                  ? await this.definitionImageService.getImageUrl("locations", sublocation.sceneImageId)
                  : sublocation.sceneImagePath
            }))
          )
        }))
      )
    };
  }
}

function parseWorldLocationsCatalog(
  defaultStateRaw: unknown,
  locationsRaw: unknown
): WorldLocationsCatalog {
  return {
    defaultState: parseWorldState(normalizeDefaultStateRaw(defaultStateRaw), "world default state"),
    locations: normalizeLocationsRaw(locationsRaw).map((entry, index) =>
      parseLocationMetadata(entry, `world locations[${index}]`)
    )
  };
}

function normalizeDefaultStateRaw(raw: unknown): unknown {
  const record = ensureRecord(raw, "world default state response");

  if ("currentLocation" in record) {
    return raw;
  }

  return record["defaultState"];
}

function normalizeLocationsRaw(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  const record = ensureRecord(raw, "world locations response");
  return ensureArray(record["locations"], "world locations");
}

function parseLocationMetadata(raw: unknown, label: string): WorldLocationMetadata {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    label: ensureString(record["label"], `${label}.label`),
    subtitle: ensureString(record["subtitle"], `${label}.subtitle`),
    sceneImageId: parseOptionalString(record["sceneImageId"], `${label}.sceneImageId`),
    sceneImagePath: parseOptionalString(record["sceneImagePath"], `${label}.sceneImagePath`),
    availableNpcIds: parseStringArray(record["availableNpcIds"], `${label}.availableNpcIds`),
    sublocations: ensureOptionalArray(record["sublocations"], `${label}.sublocations`).map(
      (entry, index) => parseSublocationMetadata(entry, `${label}.sublocations[${index}]`)
    )
  };
}

function parseSublocationMetadata(raw: unknown, label: string): WorldSublocationMetadata {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    label: ensureString(record["label"], `${label}.label`),
    subtitle: ensureString(record["subtitle"], `${label}.subtitle`),
    sceneImageId: parseOptionalString(record["sceneImageId"], `${label}.sceneImageId`),
    sceneImagePath: parseOptionalString(record["sceneImagePath"], `${label}.sceneImagePath`),
    availableNpcIds: parseStringArray(record["availableNpcIds"], `${label}.availableNpcIds`),
    isReturnable: ensureBoolean(record["isReturnable"], `${label}.isReturnable`),
    entryActionLabel: parseOptionalString(record["entryActionLabel"], `${label}.entryActionLabel`),
    exitActionLabel: parseOptionalString(record["exitActionLabel"], `${label}.exitActionLabel`),
    entryDisabledReason: parseOptionalString(
      record["entryDisabledReason"],
      `${label}.entryDisabledReason`
    ),
    entryGuards: parseOptionalGuards(record["entryGuards"], `${label}.entryGuards`),
    exitGuards: parseOptionalGuards(record["exitGuards"], `${label}.exitGuards`)
  };
}

function parseWorldState(raw: unknown, label: string): SaveSlotWorldState {
  const record = ensureRecord(raw, label);

  return cloneSaveSlotWorldState({
    currentLocation: ensureString(record["currentLocation"], `${label}.currentLocation`),
    sublocations: parseStringArray(record["sublocations"], `${label}.sublocations`)
  });
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureArray(raw: unknown, label: string): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw;
}

function ensureOptionalArray(raw: unknown, _label: string): unknown[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${_label} must be an array.`);
  }

  return raw;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function parseOptionalString(raw: unknown, label: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return ensureString(raw, label);
}

function parseStringArray(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => ensureString(entry, `${label}[${index}]`));
}

function ensureBoolean(raw: unknown, label: string): boolean {
  if (typeof raw !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return raw;
}

function parseOptionalGuards(raw: unknown, label: string): readonly Guard[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => {
    const record = ensureRecord(entry, `${label}[${index}]`);
    const type = ensureString(record["type"], `${label}[${index}].type`);
    const params = record["params"] === undefined ? undefined : (record["params"] as Record<string, unknown>);

    return { type, params } as Guard;
  });
}
