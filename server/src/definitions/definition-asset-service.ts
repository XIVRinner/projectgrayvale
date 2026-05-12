import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { DefinitionType } from "./definition-types";

export interface DefinitionAssetMetadata {
  readonly id: string;
  readonly hash: string;
  readonly contentType: string;
  readonly updatedAt: string;
}

export interface DefinitionAsset extends DefinitionAssetMetadata {
  readonly body: Buffer;
}

export class DefinitionAssetService {
  constructor(private readonly assetRoot: string) {}

  async getAssetInfo(type: DefinitionType, assetId: string): Promise<DefinitionAssetMetadata | null> {
    const filePath = await resolveAssetFilePath(this.assetRoot, type, assetId);

    if (!filePath) {
      return null;
    }

    const [fileStats, body] = await Promise.all([stat(filePath), readFile(filePath)]);

    return {
      id: assetId,
      hash: createHash("sha1").update(body).digest("hex"),
      contentType: toContentType(filePath),
      updatedAt: fileStats.mtime.toISOString(),
    };
  }

  async getAsset(type: DefinitionType, assetId: string): Promise<DefinitionAsset | null> {
    const filePath = await resolveAssetFilePath(this.assetRoot, type, assetId);

    if (!filePath) {
      return null;
    }

    const [fileStats, body] = await Promise.all([stat(filePath), readFile(filePath)]);

    return {
      id: assetId,
      hash: createHash("sha1").update(body).digest("hex"),
      contentType: toContentType(filePath),
      updatedAt: fileStats.mtime.toISOString(),
      body,
    };
  }
}

async function resolveAssetFilePath(
  assetRoot: string,
  type: DefinitionType,
  assetId: string,
): Promise<string | null> {
  const directory = resolve(join(assetRoot, type));
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${assetId}.`))
    .map((entry) => resolve(join(directory, entry.name)));

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(`Multiple ${type} assets found for "${assetId}".`);
  }

  return matches[0] ?? null;
}

function toContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
