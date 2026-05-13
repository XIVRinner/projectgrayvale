import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

import type { GrayvaleDatabase } from "../db/database";
import type { DefinitionType, SyncedDefinition } from "./definition-types";
import { definitionTypes } from "./definition-types";

const idSchema = z.string().trim().min(1);
const namedDefinitionSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1),
  })
  .passthrough();
const locationDefinitionSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1),
  })
  .passthrough();
const materialDefinitionSchema = namedDefinitionSchema
  .extend({
    category: z.literal("material"),
  })
  .passthrough();
const itemDefinitionSchema = namedDefinitionSchema
  .extend({
    category: z.string().trim().min(1),
  })
  .passthrough();

const definitionSchemaByType: Record<DefinitionType, z.ZodType<unknown>> = {
  activities: namedDefinitionSchema,
  actions: namedDefinitionSchema,
  items: itemDefinitionSchema,
  locations: locationDefinitionSchema,
  materials: materialDefinitionSchema,
};

export async function syncDefinitions(
  db: GrayvaleDatabase,
  definitionRoot: string,
): Promise<readonly SyncedDefinition[]> {
  const definitions = await loadDefinitionsFromDisk(definitionRoot);

  await db.exec("BEGIN");

  try {
    await db.exec("DELETE FROM definitions");

    for (const definition of definitions) {
      await db.run(
        `
          INSERT INTO definitions (
            type,
            id,
            version,
            hash,
            json,
            source_path,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        definition.type,
        definition.id,
        definition.version,
        definition.hash,
        definition.json,
        definition.sourcePath,
      );
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  return definitions;
}

async function loadDefinitionsFromDisk(
  definitionRoot: string,
): Promise<readonly SyncedDefinition[]> {
  const definitions: SyncedDefinition[] = [];

  for (const type of definitionTypes) {
    const directory = resolve(join(definitionRoot, type));
    const entries = await readdir(directory, { withFileTypes: true });
    const seenIds = new Set<string>();

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.startsWith("_")) {
        continue;
      }

      const filePath = resolve(join(directory, entry.name));
      const rawPayload = await readFile(filePath, "utf8");
      const payload = JSON.parse(rawPayload) as unknown;
      const parsed = definitionSchemaByType[type].parse(payload) as Record<string, unknown>;
      const id = idSchema.parse(parsed["id"]);
      const expectedFileName = `${id}.json`;

      if (entry.name !== expectedFileName) {
        throw new Error(
          `Definition file "${filePath}" must be named "${expectedFileName}" to match its id.`,
        );
      }

      if (seenIds.has(id)) {
        throw new Error(`Duplicate ${type} definition id "${id}" found in "${directory}".`);
      }

      seenIds.add(id);
      const hash = createHash("sha1").update(rawPayload).digest("hex");

      definitions.push({
        type,
        id,
        version: hash,
        hash,
        json: rawPayload,
        sourcePath: filePath,
      });
    }
  }

  return definitions;
}
