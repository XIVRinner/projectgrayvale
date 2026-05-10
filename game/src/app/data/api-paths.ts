const API_ROOT = "/api";
const DATA_API_ROOT = "/api/data";
let apiOriginOverride: string | null = null;

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
