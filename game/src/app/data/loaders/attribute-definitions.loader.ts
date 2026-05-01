import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map, Observable } from "rxjs";

export interface AttributeDefinition {
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly description?: string;
  readonly displayOrder: number;
}

@Injectable({ providedIn: "root" })
export class AttributeDefinitionsLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly AttributeDefinition[]> {
    return this.http.get<unknown>("assets/data/attributes.json").pipe(
      map((raw) => parseAttributeDefinitions(raw))
    );
  }
}

function parseAttributeDefinitions(raw: unknown): readonly AttributeDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("attributes.json must be an array.");
  }

  return raw
    .map((entry, index) => parseAttributeDefinition(entry, index))
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function parseAttributeDefinition(raw: unknown, index: number): AttributeDefinition {
  const record = ensureRecord(raw, `attributes[${index}]`);

  return {
    id: ensureString(record["id"], `attributes[${index}].id`),
    name: ensureString(record["name"], `attributes[${index}].name`),
    abbreviation: ensureString(record["abbreviation"], `attributes[${index}].abbreviation`),
    description: ensureOptionalString(record["description"], `attributes[${index}].description`),
    displayOrder: ensureNumber(record["displayOrder"], `attributes[${index}].displayOrder`)
  };
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function ensureOptionalString(raw: unknown, label: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return ensureString(raw, label);
}

function ensureNumber(raw: unknown, label: string): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    throw new Error(`${label} must be a number.`);
  }

  return raw;
}
