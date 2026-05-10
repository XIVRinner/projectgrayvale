import { createHash } from "node:crypto";

import type { GrayvaleDatabase } from "../db/database";
import type { SeededJsonResource } from "../content/content-types";
import type { ExtractedApiEntity } from "./entity-types";

export async function seedApiEntities(
  db: GrayvaleDatabase,
  resources: readonly SeededJsonResource[]
): Promise<readonly ExtractedApiEntity[]> {
  const entities = resources.flatMap((resource) => extractEntities(resource));

  await db.exec("BEGIN");

  try {
    await db.exec("DELETE FROM api_entity_tags");
    await db.exec("DELETE FROM api_entities");

    for (const entity of entities) {
      await db.run(
        `
          INSERT INTO api_entities (
            entity_type,
            entity_id,
            resource_key,
            display_name,
            category,
            slot,
            location_id,
            sublocation_id,
            sort_key,
            payload,
            checksum,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        entity.entityType,
        entity.entityId,
        entity.resourceKey,
        entity.displayName ?? null,
        entity.category ?? null,
        entity.slot ?? null,
        entity.locationId ?? null,
        entity.sublocationId ?? null,
        entity.sortKey,
        JSON.stringify(entity.payload),
        entity.checksum
      );

      for (const tag of entity.tags) {
        await db.run(
          `
            INSERT INTO api_entity_tags (entity_type, entity_id, tag)
            VALUES (?, ?, ?)
          `,
          entity.entityType,
          entity.entityId,
          tag
        );
      }
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  return entities;
}

function extractEntities(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  switch (resource.resourceKey) {
    case "activities.json":
      return extractActivities(resource);
    case "attributes.json":
      return extractArrayEntities(resource, "attribute");
    case "balance-profiles.json":
      return extractArrayEntities(resource, "balance-profile");
    case "dialogue-actors.json":
      return extractArrayEntities(resource, "dialogue-actor");
    case "dialogues.json":
      return extractArrayEntities(resource, "dialogue");
    case "equipment-items.json":
      return extractEquipmentItems(resource);
    case "inventory-items.json":
      return extractItems(resource);
    case "progression/difficulty-curves.json":
      return extractDifficultyCurves(resource);
    case "quests.json":
      return extractArrayEntities(resource, "quest");
    case "skills.json":
      return extractArrayEntities(resource, "skill");
    case "world-guards.json":
      return extractWorldGuards(resource);
    case "world-locations.json":
      return extractWorldLocations(resource);
    default:
      return [];
  }
}

function extractActivities(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  return ensureArray(resource.payload, resource.resourceKey).map((entry, index) => {
    const record = ensureRecord(entry, `${resource.resourceKey}[${index}]`);
    const id = ensureString(record["id"], `${resource.resourceKey}[${index}].id`);
    const name = ensureString(record["name"], `${resource.resourceKey}[${index}].name`);
    const location = ensureRecord(
      record["location"],
      `${resource.resourceKey}[${index}].location`
    );

    return createEntity(resource, {
      entityType: "activity",
      entityId: id,
      displayName: name,
      locationId: ensureString(
        location["locationId"],
        `${resource.resourceKey}[${index}].location.locationId`
      ),
      sublocationId:
        typeof location["sublocationId"] === "string"
          ? location["sublocationId"]
          : undefined,
      tags: ensureOptionalStringArray(record["tags"]),
      sortKey: index,
      payload: entry
    });
  });
}

function extractArrayEntities(
  resource: SeededJsonResource,
  entityType: string
): readonly ExtractedApiEntity[] {
  return ensureArray(resource.payload, resource.resourceKey).map((entry, index) => {
    const record = ensureRecord(entry, `${resource.resourceKey}[${index}]`);
    const id = ensureString(record["id"], `${resource.resourceKey}[${index}].id`);
    const name =
      typeof record["name"] === "string"
        ? record["name"]
        : typeof record["label"] === "string"
          ? record["label"]
          : undefined;

    return createEntity(resource, {
      entityType,
      entityId: id,
      displayName: name,
      category: typeof record["category"] === "string" ? record["category"] : undefined,
      slot: typeof record["slot"] === "string" ? record["slot"] : undefined,
      tags: ensureOptionalStringArray(record["tags"]),
      sortKey: index,
      payload: entry
    });
  });
}

function extractItems(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  return ensureArray(resource.payload, resource.resourceKey).map((entry, index) => {
    const record = ensureRecord(entry, `${resource.resourceKey}[${index}]`);

    return createEntity(resource, {
      entityType: "item",
      entityId: ensureString(record["id"], `${resource.resourceKey}[${index}].id`),
      displayName:
        typeof record["name"] === "string" ? record["name"] : undefined,
      category:
        typeof record["category"] === "string" ? record["category"] : undefined,
      slot: typeof record["slot"] === "string" ? record["slot"] : undefined,
      tags: ensureOptionalStringArray(record["tags"]),
      sortKey: index,
      payload: entry
    });
  });
}

function extractEquipmentItems(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  const entries = ensureArray(resource.payload, resource.resourceKey);
  const extracted: ExtractedApiEntity[] = [];

  entries.forEach((entry, index) => {
    const record = ensureRecord(entry, `${resource.resourceKey}[${index}]`);
    const id = ensureString(record["id"], `${resource.resourceKey}[${index}].id`);
    const displayName = typeof record["name"] === "string" ? record["name"] : undefined;
    const category = typeof record["category"] === "string" ? record["category"] : undefined;
    const slot = typeof record["slot"] === "string" ? record["slot"] : undefined;
    const tags = ensureOptionalStringArray(record["tags"]);

    extracted.push(
      createEntity(resource, {
        entityType: "equipment-item",
        entityId: id,
        displayName,
        category,
        slot,
        tags,
        sortKey: index,
        payload: entry
      })
    );

    if (id.startsWith("weapon_")) {
      extracted.push(
        createEntity(resource, {
          entityType: "weapon",
          entityId: id,
          displayName,
          category,
          slot,
          tags,
          sortKey: index,
          payload: entry
        })
      );
    }
  });

  return extracted;
}

function extractDifficultyCurves(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  const record = ensureRecord(resource.payload, resource.resourceKey);

  return Object.entries(record).map(([mode, value], index) =>
    createEntity(resource, {
      entityType: "difficulty-curve",
      entityId: mode,
      displayName: mode,
      sortKey: index,
      payload: {
        id: mode,
        ...ensureRecord(value, `${resource.resourceKey}.${mode}`)
      },
      tags: []
    })
  );
}

function extractWorldGuards(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  const record = ensureRecord(resource.payload, resource.resourceKey);
  const guards = ensureArray(record["guards"], `${resource.resourceKey}.guards`);

  return guards.map((entry, index) => {
    const guardRecord = ensureRecord(entry, `${resource.resourceKey}.guards[${index}]`);
    const type = ensureString(
      guardRecord["type"],
      `${resource.resourceKey}.guards[${index}].type`
    );

    return createEntity(resource, {
      entityType: "world-guard",
      entityId: type,
      displayName: type,
      sortKey: index,
      payload: entry,
      tags: []
    });
  });
}

function extractWorldLocations(resource: SeededJsonResource): readonly ExtractedApiEntity[] {
  const record = ensureRecord(resource.payload, resource.resourceKey);
  const locations = ensureArray(record["locations"], `${resource.resourceKey}.locations`);
  const entities: ExtractedApiEntity[] = [
    createEntity(resource, {
      entityType: "world-default-state",
      entityId: "default",
      displayName: "default",
      sortKey: -1,
      payload: record["defaultState"],
      tags: []
    })
  ];

  locations.forEach((entry, index) => {
    const location = ensureRecord(entry, `${resource.resourceKey}.locations[${index}]`);
    const id = ensureString(location["id"], `${resource.resourceKey}.locations[${index}].id`);
    entities.push(
      createEntity(resource, {
        entityType: "world-location",
        entityId: id,
        displayName:
          typeof location["label"] === "string" ? location["label"] : undefined,
        locationId: id,
        tags: [],
        sortKey: index,
        payload: entry
      })
    );
  });

  return entities;
}

function createEntity(
  resource: SeededJsonResource,
  input: Omit<ExtractedApiEntity, "resourceKey" | "checksum">
): ExtractedApiEntity {
  return {
    ...input,
    resourceKey: resource.resourceKey,
    checksum: createChecksum(resource.checksum, input.entityType, input.entityId, input.payload)
  };
}

function ensureArray(raw: unknown, label: string): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw;
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

function ensureOptionalStringArray(raw: unknown): readonly string[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error("Tags must be an array when present.");
  }

  return raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function createChecksum(
  resourceChecksum: string,
  entityType: string,
  entityId: string,
  payload: unknown
): string {
  return createHash("sha1")
    .update(resourceChecksum)
    .update(entityType)
    .update(entityId)
    .update(JSON.stringify(payload))
    .digest("hex");
}
