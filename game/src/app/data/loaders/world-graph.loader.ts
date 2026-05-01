import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type { Guard, WorldGraph } from "@rinner/grayvale-worldgraph";
import { map, type Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class WorldGraphLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<WorldGraph> {
    return this.http
      .get<unknown>("assets/data/world-graph.json")
      .pipe(map((raw) => parseWorldGraph(raw)));
  }
}

function parseWorldGraph(raw: unknown): WorldGraph {
  const record = ensureRecord(raw, "world graph");
  const locationsRecord = ensureRecord(record["locations"], "world graph.locations");
  const locations = Object.fromEntries(
    Object.entries(locationsRecord).map(([locationId, value]) => {
      const location = ensureRecord(value, `world graph.locations.${locationId}`);

      return [
        locationId,
        {
          id: ensureString(location["id"], `world graph.locations.${locationId}.id`),
          guards: parseOptionalGuards(
            location["guards"],
            `world graph.locations.${locationId}.guards`
          ),
          sublocations: parseOptionalStringArray(
            location["sublocations"],
            `world graph.locations.${locationId}.sublocations`
          )
        }
      ];
    })
  );

  return {
    locations,
    edges: ensureArray(record["edges"], "world graph.edges").map((entry, index) => {
      const edge = ensureRecord(entry, `world graph.edges[${index}]`);

      return {
        from: ensureString(edge["from"], `world graph.edges[${index}].from`),
        to: ensureString(edge["to"], `world graph.edges[${index}].to`),
        guards: parseOptionalGuards(
          edge["guards"],
          `world graph.edges[${index}].guards`
        )
      };
    })
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

function parseOptionalStringArray(raw: unknown, label: string): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => ensureString(entry, `${label}[${index}]`));
}

function parseOptionalGuards(raw: unknown, label: string): Guard[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => parseGuard(entry, `${label}[${index}]`));
}

function parseGuard(raw: unknown, label: string): Guard {
  const record = ensureRecord(raw, label);
  const paramsRaw = record["params"];

  return {
    type: ensureString(record["type"], `${label}.type`),
    params: parseOptionalParams(paramsRaw, `${label}.params`)
  };
}

function parseOptionalParams(
  raw: unknown,
  label: string
): Record<string, unknown> | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return ensureRecord(raw, label);
}
