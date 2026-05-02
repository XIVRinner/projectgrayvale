import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import {
  type BalanceOverrides,
  type BalanceProfile,
  type BalanceScalars,
  type ScalingOverride
} from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class BalanceProfilesLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly BalanceProfile[]> {
    return this.http.get<unknown>("assets/data/balance-profiles.json").pipe(
      map((raw) => parseBalanceProfiles(raw))
    );
  }
}

function parseBalanceProfiles(raw: unknown): readonly BalanceProfile[] {
  if (!Array.isArray(raw)) {
    throw new Error("balance-profiles.json must be an array.");
  }

  return raw.map((entry, index) => parseBalanceProfile(entry, index));
}

function parseBalanceProfile(raw: unknown, index: number): BalanceProfile {
  const record = ensureRecord(raw, `balanceProfiles[${index}]`);

  return {
    id: ensureString(record["id"], `balanceProfiles[${index}].id`),
    description: ensureOptionalString(
      record["description"],
      `balanceProfiles[${index}].description`
    ),
    scalars: parseScalars(record["scalars"], `balanceProfiles[${index}].scalars`),
    overrides: parseOverrides(record["overrides"], `balanceProfiles[${index}].overrides`)
  };
}

function parseScalars(raw: unknown, label: string): BalanceScalars | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, label);

  return {
    attributes: parseNumberRecord(record["attributes"], `${label}.attributes`),
    skills: parseNumberRecord(record["skills"], `${label}.skills`),
    combat: parseNumberRecord(record["combat"], `${label}.combat`),
    resources: parseNumberRecord(record["resources"], `${label}.resources`)
  };
}

function parseOverrides(raw: unknown, label: string): BalanceOverrides | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, label);

  return {
    scaling: parseScalingOverrides(record["scaling"], `${label}.scaling`)
  };
}

function parseScalingOverrides(
  raw: unknown,
  label: string
): ScalingOverride[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => {
    const record = ensureRecord(entry, `${label}[${index}]`);

    return {
      target: ensureString(record["target"], `${label}[${index}].target`),
      attribute: ensureString(record["attribute"], `${label}[${index}].attribute`),
      multiplier: ensureNumber(record["multiplier"], `${label}[${index}].multiplier`)
    };
  });
}

function parseNumberRecord(
  raw: unknown,
  label: string
): Record<string, number> | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, label);
  const parsed: Record<string, number> = {};

  for (const [key, value] of Object.entries(record)) {
    parsed[key] = ensureNumber(value, `${label}.${key}`);
  }

  return parsed;
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
