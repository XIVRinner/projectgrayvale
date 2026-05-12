import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { DefinitionRepository } from "./definition-repository";
import type {
  DefinitionMetadata,
  DefinitionType,
  HydratedDefinition,
} from "./definition-types";

export class DefinitionService {
  private locationDefaultsPromise: Promise<unknown> | null = null;

  constructor(
    private readonly repository: DefinitionRepository,
    private readonly definitionRoot: string,
  ) {}

  async listIds(type: DefinitionType): Promise<readonly string[]> {
    return this.repository.listIds(type);
  }

  async getById(type: DefinitionType, id: string): Promise<HydratedDefinition | null> {
    const record = await this.repository.get(type, id);
    return record ? hydrateDefinition(record) : null;
  }

  async getManyByIds(
    type: DefinitionType,
    ids: readonly string[],
  ): Promise<readonly HydratedDefinition[]> {
    const records = await this.repository.getManyByIds(type, ids);
    return records.map(hydrateDefinition);
  }

  async listDefinitions(type: DefinitionType): Promise<readonly HydratedDefinition[]> {
    const records = await this.repository.list(type);
    return records.map(hydrateDefinition);
  }

  async listMetadata(
    type: DefinitionType,
    ids: readonly string[],
  ): Promise<readonly DefinitionMetadata[]> {
    const definitions = await this.getManyByIds(type, ids);
    return definitions.map(({ id, version, hash, updatedAt }) => ({
      id,
      version,
      hash,
      updatedAt,
    }));
  }

  async listInventoryDefinitions(): Promise<readonly unknown[]> {
    const [items, materials] = await Promise.all([
      this.listDefinitions("items"),
      this.listDefinitions("materials"),
    ]);

    return [...items, ...materials]
      .map((entry) =>
        toLegacyDefinitionPayload(
          entry.definition,
          hasStringField(entry.definition, "slot") ? "items" : "materials",
        ),
      )
      .sort(compareDefinitionsById);
  }

  async listEquipmentDefinitions(): Promise<readonly unknown[]> {
    const items = await this.listDefinitions("items");
    return items
      .map((entry) => toLegacyDefinitionPayload(entry.definition, "items"))
      .filter((definition) => hasStringField(definition, "slot"))
      .sort(compareDefinitionsById);
  }

  async listActivityDefinitions(): Promise<readonly unknown[]> {
    return this.listDefinitionPayloads("activities");
  }

  async listActionDefinitions(): Promise<readonly unknown[]> {
    return this.listDefinitionPayloads("actions");
  }

  async getLocationDefaults(): Promise<unknown> {
    if (!this.locationDefaultsPromise) {
      this.locationDefaultsPromise = this.loadLocationDefaults();
    }

    return this.locationDefaultsPromise;
  }

  async getLocationBundle(): Promise<{
    readonly defaultState: unknown;
    readonly locations: readonly unknown[];
  }> {
    const [defaultState, locations] = await Promise.all([
      this.getLocationDefaults(),
      this.listDefinitionPayloads("locations"),
    ]);

    return {
      defaultState,
      locations: locations.map((location) => toLegacyDefinitionPayload(location, "locations")),
    };
  }

  private async listDefinitionPayloads(type: DefinitionType): Promise<readonly unknown[]> {
    const definitions = await this.listDefinitions(type);
    return definitions.map((entry) => entry.definition).sort(compareDefinitionsById);
  }

  private async loadLocationDefaults(): Promise<unknown> {
    const filePath = resolve(this.definitionRoot, "locations", "_defaults.json");
    const rawPayload = await readFile(filePath, "utf8");
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;

    if (!("defaultState" in parsed)) {
      throw new Error(`Location defaults file "${filePath}" must define "defaultState".`);
    }

    return parsed["defaultState"];
  }
}

function hydrateDefinition(record: {
  id: string;
  version: string;
  hash: string;
  json: string;
  updatedAt: string;
}): HydratedDefinition {
  return {
    id: record.id,
    version: record.version,
    hash: record.hash,
    updatedAt: record.updatedAt,
    definition: JSON.parse(record.json) as unknown,
  };
}

function compareDefinitionsById(left: unknown, right: unknown): number {
  const leftId = extractIdOrEmpty(left);
  const rightId = extractIdOrEmpty(right);
  return leftId.localeCompare(rightId);
}

function extractIdOrEmpty(value: unknown): string {
  if (typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }

  return "";
}

function hasStringField(
  value: unknown,
  key: string,
): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === "string"
  );
}

function toLegacyDefinitionPayload(definition: unknown, type: DefinitionType): unknown {
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    return definition;
  }

  const record = { ...(definition as Record<string, unknown>) };

  if ((type === "items" || type === "materials") && typeof record["imageId"] === "string") {
    record["iconPath"] = toDefinitionAssetPath(type, record["imageId"]);
  }

  if (type === "locations") {
    if (typeof record["sceneImageId"] === "string") {
      record["sceneImagePath"] = toDefinitionAssetPath(type, record["sceneImageId"]);
    }

    if (Array.isArray(record["sublocations"])) {
      record["sublocations"] = record["sublocations"].map((entry) =>
        toLegacyDefinitionPayload(entry, "locations"),
      );
    }
  }

  return record;
}

function toDefinitionAssetPath(type: DefinitionType, assetId: unknown): string {
  return `/api/assets/${type}/${encodeURIComponent(String(assetId))}`;
}
