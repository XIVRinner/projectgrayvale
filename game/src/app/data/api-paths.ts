const API_ROOT = "/api";
const DATA_API_ROOT = "/api/data";

export function apiPath(resourcePath: string): string {
  const normalized = resourcePath.replace(/^\/+/, "").replace(/\.json$/, "");
  return `${API_ROOT}/${normalized}`;
}

export function dataApiPath(resourcePath: string): string {
  const normalized = resourcePath.replace(/^\/+/, "").replace(/\.json$/, "");
  return `${DATA_API_ROOT}/${normalized}`;
}
