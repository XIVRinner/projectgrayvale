import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { type AllowedTagTarget, type TagRegistry, allowedTagTargets } from "./tag-registry-schema";

const definitionTypesWithSublocations = allowedTagTargets;
const definitionTypes = ["items", "materials", "locations", "activities", "actions"] as const;

export interface TagUsageOccurrence {
  readonly definitionType: AllowedTagTarget;
  readonly definitionId: string;
  readonly tag: string;
  readonly source: string;
}

export interface TagDiscoveryReport {
  readonly currentTagModel: "string[]" | "other";
  readonly centralizedRegistryExists: boolean;
  readonly centralizedRegistryPath?: string;
  readonly discoveredTags: readonly string[];
  readonly tagsByDefinitionType: Record<AllowedTagTarget, readonly string[]>;
  readonly unknownOrUncategorizedTags: readonly string[];
  readonly duplicateCaseInsensitiveTags: readonly string[];
}

export interface TagValidationResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export async function discoverTagUsage(
  definitionRoot: string,
  registry: TagRegistry | null,
  registryPath?: string,
): Promise<TagDiscoveryReport> {
  const usageScan = await scanDefinitionTagUsage(definitionRoot);
  const registryTagMap = registry ? buildRegistryTagLookup(registry) : new Map<string, string>();
  const discoveredCaseMap = new Map<string, Set<string>>();
  for (const tag of usageScan.discoveredTags) {
    const normalized = tag.toLowerCase();
    const existing = discoveredCaseMap.get(normalized) ?? new Set<string>();
    existing.add(tag);
    discoveredCaseMap.set(normalized, existing);
  }
  const duplicateCaseInsensitiveTags = [...discoveredCaseMap.values()]
    .filter((variants) => variants.size > 1)
    .map((variants) => [...variants].sort((left, right) => left.localeCompare(right)).join(" | "))
    .sort((left, right) => left.localeCompare(right));
  const unknownOrUncategorizedTags = usageScan.discoveredTags.filter(
    (tag) => !registryTagMap.has(tag.toLowerCase()),
  );

  return {
    currentTagModel: "string[]",
    centralizedRegistryExists: registry !== null,
    centralizedRegistryPath: registryPath,
    discoveredTags: usageScan.discoveredTags,
    tagsByDefinitionType: usageScan.tagsByDefinitionType,
    unknownOrUncategorizedTags,
    duplicateCaseInsensitiveTags,
  };
}

export function validateTagRegistry(registry: TagRegistry): TagValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const categoryIds = new Map<string, string>();
  const tagIds = new Map<string, string>();
  const validAllowedFor = new Set<string>(definitionTypesWithSublocations);

  for (const category of registry.categories) {
    const normalizedCategoryId = category.id.toLowerCase();
    const existingCategory = categoryIds.get(normalizedCategoryId);

    if (existingCategory) {
      errors.push(`Duplicate category id (case-insensitive): ${existingCategory} / ${category.id}`);
    } else {
      categoryIds.set(normalizedCategoryId, category.id);
    }

    for (const allowedFor of category.allowedFor) {
      if (!validAllowedFor.has(allowedFor)) {
        errors.push(`Invalid allowedFor value "${allowedFor}" in category "${category.id}".`);
      }
    }

    for (const tag of category.tags) {
      const normalizedTagId = tag.id.toLowerCase();
      const existingTag = tagIds.get(normalizedTagId);

      if (existingTag) {
        errors.push(`Duplicate tag id (case-insensitive): ${existingTag} / ${tag.id}`);
      } else {
        tagIds.set(normalizedTagId, tag.id);
      }
    }
  }

  if (registry.categories.length === 0) {
    warnings.push("Tag registry currently has zero categories.");
  }

  return { errors, warnings };
}

export async function scanDefinitionTagUsage(
  definitionRoot: string,
): Promise<{
  readonly discoveredTags: readonly string[];
  readonly tagsByDefinitionType: Record<AllowedTagTarget, readonly string[]>;
  readonly usages: readonly TagUsageOccurrence[];
}> {
  const tagsByType = new Map<AllowedTagTarget, Set<string>>(
    definitionTypesWithSublocations.map((type) => [type, new Set<string>()]),
  );
  const usages: TagUsageOccurrence[] = [];

  for (const definitionType of definitionTypes) {
    const directoryPath = resolve(definitionRoot, definitionType);
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.startsWith("_")) {
        continue;
      }

      const sourcePath = resolve(directoryPath, entry.name);
      const raw = await readFile(sourcePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const definitionId = toDefinitionId(parsed, entry.name);
      collectTagUsages(parsed, definitionType, definitionId, sourcePath, usages, tagsByType);
    }
  }

  const discoveredTags = [...new Set(usages.map((usage) => usage.tag))].sort((left, right) =>
    left.localeCompare(right),
  );

  const tagsByDefinitionType = {} as Record<AllowedTagTarget, readonly string[]>;
  for (const type of definitionTypesWithSublocations) {
    tagsByDefinitionType[type] = [...(tagsByType.get(type) ?? new Set<string>())].sort(
      (left, right) => left.localeCompare(right),
    );
  }

  return {
    discoveredTags,
    tagsByDefinitionType,
    usages,
  };
}

export function validateDefinitionTagsAgainstRegistry(
  registry: TagRegistry,
  scan: {
    readonly usages: readonly TagUsageOccurrence[];
  },
): TagValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registryTagLookup = buildRegistryTagLookup(registry);
  const allowedByType = buildAllowedTagLookup(registry);

  for (const usage of scan.usages) {
    const canonicalTag = registryTagLookup.get(usage.tag.toLowerCase());

    if (!canonicalTag) {
      errors.push(
        `${usage.definitionType}/${usage.definitionId} uses unknown tag "${usage.tag}" (${usage.source}).`,
      );
      continue;
    }

    if (canonicalTag !== usage.tag) {
      warnings.push(
        `${usage.definitionType}/${usage.definitionId} uses non-canonical tag casing "${usage.tag}" (canonical: "${canonicalTag}").`,
      );
    }

    const allowedTags = allowedByType.get(usage.definitionType) ?? new Set<string>();
    if (!allowedTags.has(canonicalTag.toLowerCase())) {
      warnings.push(
        `${usage.definitionType}/${usage.definitionId} uses "${canonicalTag}" but its category does not allow "${usage.definitionType}".`,
      );
    }
  }

  return { errors, warnings };
}

function collectTagUsages(
  value: unknown,
  definitionType: AllowedTagTarget,
  definitionId: string,
  sourcePath: string,
  usages: TagUsageOccurrence[],
  tagsByType: Map<AllowedTagTarget, Set<string>>,
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTagUsages(entry, definitionType, definitionId, sourcePath, usages, tagsByType);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const rawTags = record["tags"];
  const currentType = definitionType;

  if (Array.isArray(rawTags)) {
    for (const rawTag of rawTags) {
      if (typeof rawTag !== "string" || rawTag.trim().length === 0) {
        continue;
      }

      const tag = rawTag.trim();
      usages.push({
        definitionType: currentType,
        definitionId,
        tag,
        source: sourcePath,
      });
      tagsByType.get(currentType)?.add(tag);
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === "sublocations" && Array.isArray(child)) {
      for (const sublocation of child) {
        collectTagUsages(sublocation, "sublocations", definitionId, sourcePath, usages, tagsByType);
      }
      continue;
    }

    collectTagUsages(child, definitionType, definitionId, sourcePath, usages, tagsByType);
  }
}

function buildRegistryTagLookup(registry: TagRegistry): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const category of registry.categories) {
    for (const tag of category.tags) {
      lookup.set(tag.id.toLowerCase(), tag.id);
    }
  }

  return lookup;
}

function buildAllowedTagLookup(registry: TagRegistry): Map<AllowedTagTarget, Set<string>> {
  const byType = new Map<AllowedTagTarget, Set<string>>(
    definitionTypesWithSublocations.map((type) => [type, new Set<string>()]),
  );

  for (const category of registry.categories) {
    for (const target of category.allowedFor) {
      const existing = byType.get(target);

      if (!existing) {
        continue;
      }

      for (const tag of category.tags) {
        existing.add(tag.id.toLowerCase());
      }
    }
  }

  return byType;
}

function toDefinitionId(
  definition: Record<string, unknown>,
  fallbackFileName: string,
): string {
  const id = definition["id"];
  if (typeof id === "string" && id.trim().length > 0) {
    return id.trim();
  }

  return fallbackFileName.replace(/\.json$/u, "");
}
