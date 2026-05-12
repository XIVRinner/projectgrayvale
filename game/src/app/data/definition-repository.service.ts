import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import {
  type ActionDefinition,
  type ActivityDefinition,
} from "@rinner/grayvale-core";
import { firstValueFrom } from "rxjs";

import {
  apiPath,
  definitionBatchApiPath,
  definitionInfoApiPath,
  type DefinitionApiType,
} from "./api-paths";
import {
  openGrayvaleIndexedDb,
  DEFINITION_STORE_NAME,
} from "./grayvale-indexed-db";
import {
  parseActionDefinition,
  parseActivityDefinition,
  parseEquipmentItemDefinition,
  parseInventoryItemDefinition,
  parseMaterialDefinition,
  type GameInventoryEquipmentItem,
  type GameInventoryItemDefinition,
  type GameInventoryMaterialItem,
} from "./definition-parsers";

export interface CachedDefinitionRecord {
  readonly key: string;
  readonly type: DefinitionApiType;
  readonly id: string;
  readonly hash: string;
  readonly version: string;
  readonly updatedAt: string;
  readonly cachedAt: string;
  readonly definition: unknown;
}

export interface LocationDefinitionRecord {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly sceneImageId?: string;
  readonly sceneImagePath?: string;
  readonly availableNpcIds: readonly string[];
  readonly sublocations?: readonly LocationDefinitionRecord[];
  readonly isReturnable?: boolean;
  readonly entryActionLabel?: string;
  readonly exitActionLabel?: string;
  readonly entryDisabledReason?: string;
  readonly entryGuards?: readonly unknown[];
  readonly exitGuards?: readonly unknown[];
}

interface DefinitionMetadata {
  readonly id: string;
  readonly hash: string;
  readonly version: string;
  readonly updatedAt: string;
}

interface HydratedDefinitionResponse {
  readonly id: string;
  readonly hash: string;
  readonly version: string;
  readonly updatedAt: string;
  readonly definition: unknown;
}

@Injectable({ providedIn: "root" })
export class DefinitionRepositoryService {
  private readonly http = inject(HttpClient);

  private readonly memoryCache = new Map<string, CachedDefinitionRecord>();

  async listItemIds(): Promise<readonly string[]> {
    return this.listIds("items");
  }

  async listIds(type: DefinitionApiType): Promise<readonly string[]> {
    return firstValueFrom(this.http.get<readonly string[]>(apiPath(type)));
  }

  async getItem(id: string): Promise<GameInventoryItemDefinition> {
    const [item] = await this.getItems([id]);
    return item;
  }

  async getItems(ids: readonly string[]): Promise<GameInventoryItemDefinition[]> {
    return this.getDefinitions("items", ids, parseInventoryItemDefinition);
  }

  async getEquipmentItems(ids: readonly string[]): Promise<GameInventoryEquipmentItem[]> {
    return this.getDefinitions("items", ids, parseEquipmentItemDefinition);
  }

  async getMaterial(id: string): Promise<GameInventoryMaterialItem> {
    const [material] = await this.getDefinitions("materials", [id], parseMaterialDefinition);
    return material;
  }

  async getLocation(id: string): Promise<LocationDefinitionRecord> {
    const [location] = await this.getDefinitions("locations", [id], parseLocationDefinition);
    return location;
  }

  async getActivity(id: string): Promise<ActivityDefinition> {
    const [activity] = await this.getDefinitions("activities", [id], parseActivityDefinition);
    return activity;
  }

  async getAction(id: string): Promise<ActionDefinition> {
    const [action] = await this.getDefinitions("actions", [id], parseActionDefinition);
    return action;
  }

  async invalidateDefinition(type: DefinitionApiType, id: string): Promise<void> {
    this.memoryCache.delete(toDefinitionCacheKey(type, id));
    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(DEFINITION_STORE_NAME, "readwrite");
      const request = transaction.objectStore(DEFINITION_STORE_NAME).delete(toDefinitionCacheKey(type, id));
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async invalidateType(type: DefinitionApiType): Promise<void> {
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(`${type}:`)) {
        this.memoryCache.delete(key);
      }
    }

    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(DEFINITION_STORE_NAME, "readwrite");
      const store = transaction.objectStore(DEFINITION_STORE_NAME);
      const index = store.index("by_type");
      const request = index.openKeyCursor(IDBKeyRange.only(type));

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        store.delete(cursor.primaryKey);
        cursor.continue();
      };

      request.onerror = () => resolve();
    });
  }

  private async getDefinitions<T>(
    type: DefinitionApiType,
    ids: readonly string[],
    parseDefinition: (value: unknown) => T,
  ): Promise<T[]> {
    const uniqueIds = dedupeIds(ids);

    if (uniqueIds.length === 0) {
      return [];
    }

    const cachedRecords = await Promise.all(uniqueIds.map((id) => this.readCachedDefinition(type, id)));
    const cachedById = new Map<string, CachedDefinitionRecord>();

    for (const record of cachedRecords) {
      if (record) {
        cachedById.set(record.id, record);
      }
    }

    const metadata = await this.fetchMetadata(type, uniqueIds, cachedById);
    const staleOrMissingIds = uniqueIds.filter((id) => {
      const cached = cachedById.get(id);
      const remote = metadata.get(id);

      if (!cached) {
        return true;
      }

      if (!remote) {
        return false;
      }

      return (
        cached.hash !== remote.hash ||
        cached.version !== remote.version ||
        cached.updatedAt !== remote.updatedAt
      );
    });

    if (staleOrMissingIds.length > 0) {
      const freshDefinitions = await this.fetchDefinitions(type, staleOrMissingIds);

      for (const entry of freshDefinitions) {
        const record: CachedDefinitionRecord = {
          key: toDefinitionCacheKey(type, entry.id),
          type,
          id: entry.id,
          hash: entry.hash,
          version: entry.version,
          updatedAt: entry.updatedAt,
          cachedAt: new Date().toISOString(),
          definition: entry.definition,
        };

        cachedById.set(entry.id, record);
        await this.writeCachedDefinition(record);
      }
    }

    return uniqueIds.map((id) => {
      const record = cachedById.get(id);

      if (!record) {
        throw new Error(`Missing cached ${type} definition for "${id}".`);
      }

      return parseDefinition(record.definition);
    });
  }

  private async fetchMetadata(
    type: DefinitionApiType,
    ids: readonly string[],
    cachedById: ReadonlyMap<string, CachedDefinitionRecord>,
  ): Promise<Map<string, DefinitionMetadata>> {
    const idsToCheck = ids.filter((id) => cachedById.has(id));

    if (idsToCheck.length === 0) {
      return new Map();
    }

    try {
      const metadata = await firstValueFrom(
        this.http.post<readonly DefinitionMetadata[]>(definitionInfoApiPath(type), idsToCheck),
      );
      return new Map(metadata.map((entry) => [entry.id, entry]));
    } catch {
      return new Map();
    }
  }

  private async fetchDefinitions(
    type: DefinitionApiType,
    ids: readonly string[],
  ): Promise<readonly HydratedDefinitionResponse[]> {
    return firstValueFrom(
      this.http.post<readonly HydratedDefinitionResponse[]>(definitionBatchApiPath(type), ids),
    );
  }

  private async readCachedDefinition(
    type: DefinitionApiType,
    id: string,
  ): Promise<CachedDefinitionRecord | null> {
    const key = toDefinitionCacheKey(type, id);
    const memoryEntry = this.memoryCache.get(key);

    if (memoryEntry) {
      return memoryEntry;
    }

    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(DEFINITION_STORE_NAME, "readonly");
      const request = transaction.objectStore(DEFINITION_STORE_NAME).get(key);

      request.onsuccess = () => {
        const record = normalizeCachedDefinitionRecord(request.result);

        if (record) {
          this.memoryCache.set(key, record);
        }

        resolve(record);
      };

      request.onerror = () => resolve(null);
    });
  }

  private async writeCachedDefinition(record: CachedDefinitionRecord): Promise<void> {
    this.memoryCache.set(record.key, record);
    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(DEFINITION_STORE_NAME, "readwrite");
      const request = transaction.objectStore(DEFINITION_STORE_NAME).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
}

function parseLocationDefinition(raw: unknown): LocationDefinitionRecord {
  const record = ensureRecord(raw, "location definition");

  return {
    id: ensureString(record["id"], "location.id"),
    label: ensureString(record["label"], "location.label"),
    subtitle: ensureString(record["subtitle"], "location.subtitle"),
    sceneImageId: parseOptionalString(record["sceneImageId"]),
    sceneImagePath: parseOptionalString(record["sceneImagePath"]),
    availableNpcIds: ensureStringArray(record["availableNpcIds"], "location.availableNpcIds"),
    sublocations: Array.isArray(record["sublocations"])
      ? record["sublocations"].map((entry) => parseLocationDefinition(entry))
      : undefined,
    isReturnable: typeof record["isReturnable"] === "boolean" ? record["isReturnable"] : undefined,
    entryActionLabel: parseOptionalString(record["entryActionLabel"]),
    exitActionLabel: parseOptionalString(record["exitActionLabel"]),
    entryDisabledReason: parseOptionalString(record["entryDisabledReason"]),
    entryGuards: Array.isArray(record["entryGuards"]) ? record["entryGuards"] : undefined,
    exitGuards: Array.isArray(record["exitGuards"]) ? record["exitGuards"] : undefined,
  };
}

function normalizeCachedDefinitionRecord(raw: unknown): CachedDefinitionRecord | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (
    typeof record["key"] !== "string" ||
    typeof record["type"] !== "string" ||
    typeof record["id"] !== "string" ||
    typeof record["hash"] !== "string" ||
    typeof record["version"] !== "string" ||
    typeof record["updatedAt"] !== "string" ||
    typeof record["cachedAt"] !== "string"
  ) {
    return null;
  }

  return {
    key: record["key"],
    type: record["type"] as DefinitionApiType,
    id: record["id"],
    hash: record["hash"],
    version: record["version"],
    updatedAt: record["updatedAt"],
    cachedAt: record["cachedAt"],
    definition: record["definition"],
  };
}

function toDefinitionCacheKey(type: DefinitionApiType, id: string): string {
  return `${type}:${id}`;
}

function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));
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

function parseOptionalString(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;
}

function ensureStringArray(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => ensureString(entry, `${label}[${index}]`));
}
