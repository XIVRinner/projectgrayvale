import type { KairosDefinitionType, KairosEditorState, KairosFieldChange, KairosPathSegment, KairosTagOption } from "./kairos-edit.types";

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function createEditorState(): KairosEditorState {
  return {
    ids: [],
    listItems: [],
    selectedId: null,
    definition: null,
    jsonText: "",
    jsonError: null,
    loading: false,
    saving: false,
    statusMessage: null,
    validationErrors: [],
    validationWarnings: []
  };
}

export function cloneDefinition(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function formatDefinitionJson(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function applyFieldChange(
  definition: Record<string, unknown>,
  change: KairosFieldChange,
): Record<string, unknown> {
  const nextDefinition = cloneDefinition(definition);
  setPathValue(nextDefinition, change.path, normalizeFieldValue(change.value));
  return nextDefinition;
}

export function readPathValue(
  definition: Record<string, unknown> | null,
  path: readonly KairosPathSegment[],
): unknown {
  if (!definition) {
    return undefined;
  }

  let current: unknown = definition;

  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }

      current = current[segment];
      continue;
    }

    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function readStringValue(
  definition: Record<string, unknown> | null,
  path: readonly KairosPathSegment[],
): string {
  const value = readPathValue(definition, path);
  return typeof value === "string" ? value : "";
}

export function readOptionalNumberValue(
  definition: Record<string, unknown> | null,
  path: readonly KairosPathSegment[],
): number | null {
  const value = readPathValue(definition, path);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readBooleanValue(
  definition: Record<string, unknown> | null,
  path: readonly KairosPathSegment[],
  fallback = false,
): boolean {
  const value = readPathValue(definition, path);
  return typeof value === "boolean" ? value : fallback;
}

export function readStringArrayValue(
  definition: Record<string, unknown> | null,
  path: readonly KairosPathSegment[],
): string[] {
  const value = readPathValue(definition, path);

  if (!Array.isArray(value)) {
    return [];
  }

  if (value.every((entry) => typeof entry === "string")) {
    return value as string[];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function parseDefinitionJson(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Definition JSON must be a single object.");
  }

  return parsed as Record<string, unknown>;
}

export function createDefaultDefinition(type: KairosDefinitionType): Record<string, unknown> {
  switch (type) {
    case "items":
      return {
        id: "",
        name: "",
        category: "equipment",
        rarity: "common",
        tags: [],
        slot: "main_hand",
        itemLevel: 1,
      };
    case "materials":
      return {
        id: "",
        name: "",
        category: "material",
        rarity: "common",
        tags: [],
        quantity: 0,
      };
    case "locations":
      return {
        id: "",
        label: "",
        subtitle: "",
        availableNpcIds: [],
        sublocations: [],
      };
    case "activities":
      return {
        id: "",
        name: "",
        tags: [],
        governingAttributes: [],
        difficulty: 1,
        location: {
          locationId: "",
        },
      };
    case "actions":
      return {
        id: "",
        name: "",
        tags: [],
        cost: {
          type: "calculated",
          base: 0,
        },
        effect: {
          type: "heal_full",
        },
      };
  }
}

export function validateDefinitionDraft(
  type: KairosDefinitionType,
  state: KairosEditorState,
  tagOptions: readonly KairosTagOption[],
): { readonly errors: readonly string[]; readonly warnings: readonly string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const definition = state.definition;

  if (!definition) {
    return {
      errors: ["No definition is currently loaded."],
      warnings,
    };
  }

  if (state.jsonError) {
    errors.push(state.jsonError);
  }

  const id = readStringValue(definition, ["id"]).trim();

  if (!id) {
    errors.push("Definition id is required.");
  } else if (!ID_PATTERN.test(id)) {
    errors.push(
      "Definition id must use lowercase letters, numbers, underscores, or hyphens.",
    );
  }

  if (state.ids.includes(id) && id !== state.selectedId) {
    warnings.push(`Saving will overwrite the existing ${type} definition "${id}".`);
  }

  const tags = readStringArrayValue(definition, ["tags"]);
  const allowedTags = new Set(tagOptions.map((option) => option.id));
  const invalidTags = tags.filter((tag) => !allowedTags.has(tag));

  if (invalidTags.length > 0) {
    errors.push(`Unknown tags selected: ${invalidTags.join(", ")}.`);
  }

  switch (type) {
    case "items": {
      if (!readStringValue(definition, ["name"]).trim()) {
        errors.push("Item name is required.");
      }
      if (!readStringValue(definition, ["category"]).trim()) {
        errors.push("Item category is required.");
      }
      break;
    }
    case "materials": {
      if (!readStringValue(definition, ["name"]).trim()) {
        errors.push("Material name is required.");
      }
      if (readStringValue(definition, ["category"]) !== "material") {
        errors.push('Material category must stay set to "material".');
      }
      break;
    }
    case "locations": {
      if (!readStringValue(definition, ["label"]).trim()) {
        errors.push("Location label is required.");
      }
      if (!readStringValue(definition, ["subtitle"]).trim()) {
        errors.push("Location subtitle is required.");
      }
      break;
    }
    case "activities": {
      if (!readStringValue(definition, ["name"]).trim()) {
        errors.push("Activity name is required.");
      }
      if (!readStringValue(definition, ["location", "locationId"]).trim()) {
        errors.push("Activity locationId is required.");
      }
      if (readStringArrayValue(definition, ["governingAttributes"]).length === 0) {
        errors.push("Activity governingAttributes must include at least one attribute.");
      }
      break;
    }
    case "actions": {
      if (!readStringValue(definition, ["name"]).trim()) {
        errors.push("Action name is required.");
      }
      if (readPathValue(definition, ["cost"]) === undefined) {
        errors.push("Action cost is required.");
      }
      if (readPathValue(definition, ["effect"]) === undefined) {
        errors.push("Action effect is required.");
      }
      break;
    }
  }

  return {
    errors,
    warnings,
  };
}

function normalizeFieldValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return value;
}

function setPathValue(
  target: Record<string, unknown> | unknown[],
  path: readonly KairosPathSegment[],
  value: unknown,
): void {
  if (path.length === 0) {
    return;
  }

  const [head, ...tail] = path;

  if (tail.length === 0) {
    if (typeof head === "number") {
      if (!Array.isArray(target)) {
        return;
      }

      if (shouldDeleteValue(value)) {
        target.splice(head, 1);
      } else {
        target[head] = value;
      }
      return;
    }

    if (shouldDeleteValue(value)) {
      delete (target as Record<string, unknown>)[head];
    } else {
      (target as Record<string, unknown>)[head] = value;
    }
    return;
  }

  const nextSegment = tail[0];
  const container = ensureContainer(target, head, nextSegment);
  setPathValue(container, tail, value);

  if (typeof head !== "number" && isEmptyContainer(container)) {
    delete (target as Record<string, unknown>)[head];
  }
}

function ensureContainer(
  target: Record<string, unknown> | unknown[],
  segment: KairosPathSegment,
  nextSegment: KairosPathSegment,
): Record<string, unknown> | unknown[] {
  const existing = typeof segment === "number"
    ? (Array.isArray(target) ? target[segment] : undefined)
    : (target as Record<string, unknown>)[segment];

  if (Array.isArray(existing) || (typeof existing === "object" && existing !== null)) {
    return existing as Record<string, unknown> | unknown[];
  }

  const nextContainer: Record<string, unknown> | unknown[] =
    typeof nextSegment === "number" ? [] : {};

  if (typeof segment === "number") {
    (target as unknown[])[segment] = nextContainer;
  } else {
    (target as Record<string, unknown>)[segment] = nextContainer;
  }

  return nextContainer;
}

function isEmptyContainer(value: Record<string, unknown> | unknown[]): boolean {
  return Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
}

function shouldDeleteValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
