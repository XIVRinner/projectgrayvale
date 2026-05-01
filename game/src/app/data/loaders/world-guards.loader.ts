import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map, type Observable } from "rxjs";

export interface WorldGuardDefinition {
  readonly type: string;
  readonly failureMessageTemplate: string;
}

export interface WorldGuardCatalog {
  readonly guards: readonly WorldGuardDefinition[];
}

@Injectable({ providedIn: "root" })
export class WorldGuardsLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<WorldGuardCatalog> {
    return this.http
      .get<unknown>("assets/data/world-guards.json")
      .pipe(map((raw) => parseWorldGuardCatalog(raw)));
  }
}

function parseWorldGuardCatalog(raw: unknown): WorldGuardCatalog {
  const record = ensureRecord(raw, "world guards");

  return {
    guards: ensureArray(record["guards"], "world guards.guards").map((entry, index) =>
      parseWorldGuardDefinition(entry, `world guards.guards[${index}]`)
    )
  };
}

function parseWorldGuardDefinition(raw: unknown, label: string): WorldGuardDefinition {
  const record = ensureRecord(raw, label);

  return {
    type: ensureString(record["type"], `${label}.type`),
    failureMessageTemplate: ensureString(
      record["failureMessageTemplate"],
      `${label}.failureMessageTemplate`
    )
  };
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

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}
