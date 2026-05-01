import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map, type Observable } from "rxjs";

import {
  cloneSaveSlotWorldState,
  type SaveSlotWorldState
} from "../../core/services/world-state.models";

export interface WorldSublocationMetadata {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly sceneImagePath?: string;
  readonly availableNpcIds: readonly string[];
  readonly isReturnable: boolean;
  readonly entryActionLabel?: string;
  readonly exitActionLabel?: string;
}

export interface WorldLocationMetadata {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
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
  private readonly http = inject(HttpClient);

  load(): Observable<WorldLocationsCatalog> {
    return this.http
      .get<unknown>("assets/data/world-locations.json")
      .pipe(map((raw) => parseWorldLocationsCatalog(raw)));
  }
}

function parseWorldLocationsCatalog(raw: unknown): WorldLocationsCatalog {
  const record = ensureRecord(raw, "world locations");

  return {
    defaultState: parseWorldState(record["defaultState"], "world locations.defaultState"),
    locations: ensureArray(record["locations"], "world locations.locations").map((entry, index) =>
      parseLocationMetadata(entry, `world locations.locations[${index}]`)
    )
  };
}

function parseLocationMetadata(raw: unknown, label: string): WorldLocationMetadata {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    label: ensureString(record["label"], `${label}.label`),
    subtitle: ensureString(record["subtitle"], `${label}.subtitle`),
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
    sceneImagePath: parseOptionalString(record["sceneImagePath"], `${label}.sceneImagePath`),
    availableNpcIds: parseStringArray(record["availableNpcIds"], `${label}.availableNpcIds`),
    isReturnable: ensureBoolean(record["isReturnable"], `${label}.isReturnable`),
    entryActionLabel: parseOptionalString(record["entryActionLabel"], `${label}.entryActionLabel`),
    exitActionLabel: parseOptionalString(record["exitActionLabel"], `${label}.exitActionLabel`)
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
