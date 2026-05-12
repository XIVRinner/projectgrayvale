import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import type { GrayvaleDatabase } from "../db/database";
import type { SeededJsonResource } from "./content-types";
import { validateJsonDocument } from "./content-validator";

export async function seedJsonResources(
  db: GrayvaleDatabase,
  contentRoot: string
): Promise<readonly SeededJsonResource[]> {
  const files = await listJsonFiles(contentRoot);
  const resources = await Promise.all(
    files.map((filePath) => readSeededResource(contentRoot, filePath))
  );

  await db.exec("BEGIN");

  try {
    for (const resource of resources) {
      await db.run(
        `
          INSERT INTO json_resources (resource_key, source_path, payload, checksum, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(resource_key) DO UPDATE SET
            source_path = excluded.source_path,
            payload = excluded.payload,
            checksum = excluded.checksum,
            updated_at = CURRENT_TIMESTAMP
          WHERE json_resources.checksum <> excluded.checksum
             OR json_resources.source_path <> excluded.source_path
        `,
        resource.resourceKey,
        resource.sourcePath,
        resource.rawPayload,
        resource.checksum
      );
    }

    if (resources.length === 0) {
      await db.exec("DELETE FROM json_resources");
    } else {
      const placeholders = resources.map(() => "?").join(", ");
      const resourceKeys = resources.map((resource) => resource.resourceKey);
      await db.run(
        `DELETE FROM json_resources WHERE resource_key NOT IN (${placeholders})`,
        ...resourceKeys
      );
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  return resources;
}

async function readSeededResource(
  contentRoot: string,
  filePath: string
): Promise<SeededJsonResource> {
  const rawPayload = await readFile(filePath, "utf8");
  const payload = JSON.parse(rawPayload) as unknown;
  const resourceKey = relative(contentRoot, filePath).replace(/\\/g, "/");

  validateJsonDocument(resourceKey, payload);

  return {
    resourceKey,
    sourcePath: filePath,
    payload,
    rawPayload,
    checksum: createChecksum(rawPayload)
  };
}

async function listJsonFiles(rootDir: string): Promise<readonly string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(join(rootDir, entry.name));

    if (entry.isDirectory()) {
      results.push(...(await listJsonFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(entryPath);
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function createChecksum(source: string): string {
  return createHash("sha1").update(source).digest("hex");
}
