type ParsedWithOptionalIcon<T extends object> = T & { iconPath?: string };

export function parseItemArrayWithIconPath<T extends object>(
  raw: unknown,
  parseItem: (value: unknown) => T
): ParsedWithOptionalIcon<T>[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected an item array.");
  }

  return raw.map((entry) => parseItemWithIconPath(entry, parseItem));
}

export function parseItemWithIconPath<T extends object>(
  raw: unknown,
  parseItem: (value: unknown) => T
): ParsedWithOptionalIcon<T> {
  const record = isPlainObject(raw) ? { ...raw } : raw;
  const iconPath =
    isPlainObject(record) && typeof record["iconPath"] === "string" ? record["iconPath"] : undefined;

  if (isPlainObject(record) && "iconPath" in record) {
    delete record["iconPath"];
  }

  const parsed = parseItem(record) as ParsedWithOptionalIcon<T>;

  if (iconPath) {
    parsed.iconPath = iconPath;
  }

  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
