const API_ROOT = "/api";
const DATA_API_ROOT = "/api/data";
let apiOriginOverride: string | null = null;

/**
 * Definition/asset categories mirrored by the server definition and asset routes.
 * Keep this union aligned with the server's DefinitionType route registry.
 */
export type DefinitionApiType =
  | "items"
  | "materials"
  | "locations"
  | "activities"
  | "actions";

export function setApiOriginOverride(value: string | null): void {
  apiOriginOverride = normalizeOrigin(value);
}

export function apiPath(resourcePath: string): string {
  const normalized = resourcePath.replace(/^\/+/, "").replace(/\.json$/, "");
  return `${resolveApiRoot()}/${normalized}`;
}

export function dataApiPath(resourcePath: string): string {
  const normalized = resourcePath.replace(/^\/+/, "").replace(/\.json$/, "");
  return `${resolveDataApiRoot()}/${normalized}`;
}

export function definitionBatchApiPath(type: DefinitionApiType): string {
  return apiPath(`definitions/${type}/batch`);
}

export function definitionInfoApiPath(type: DefinitionApiType): string {
  return apiPath(`definitions/${type}/info`);
}

export function assetApiPath(type: DefinitionApiType, assetId: string): string {
  return apiPath(`assets/${type}/${encodeURIComponent(assetId)}`);
}

export function assetInfoApiPath(type: DefinitionApiType, assetId: string): string {
  return apiPath(`assets/${type}/${encodeURIComponent(assetId)}/info`);
}

function resolveApiRoot(): string {
  if (!apiOriginOverride) {
    return API_ROOT;
  }

  return `${apiOriginOverride}${API_ROOT}`;
}

function resolveDataApiRoot(): string {
  if (!apiOriginOverride) {
    return DATA_API_ROOT;
  }

  return `${apiOriginOverride}${DATA_API_ROOT}`;
}

function normalizeOrigin(value: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}
