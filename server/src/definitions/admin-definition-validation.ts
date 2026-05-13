import { readFile } from "node:fs/promises";

import {
  actionDefinitionSchema,
  activityDefinitionSchema,
  inventoryItemDefinitionSchema,
  inventoryMaterialItemSchema,
} from "@rinner/grayvale-core";
import { z } from "zod";

import type { DefinitionAssetService } from "./definition-asset-service";
import type { DefinitionType } from "./definition-types";
import {
  type TagRegistry,
  tagRegistrySchema,
} from "../tags/tag-registry-schema";

const definitionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, {
    message:
      "Definition ids must use lowercase letters, numbers, underscores, or hyphens.",
  });
const tagSchema = z.string().trim().min(1);
const locationReferenceSchema = z
  .object({
    locationId: definitionIdSchema,
    sublocationId: definitionIdSchema.optional(),
  })
  .strict();
const activityQuestSignalSchema = z
  .object({
    type: z.literal("kill"),
    target: definitionIdSchema,
    count: z.number().int().min(1),
  })
  .strict();
const locationGuardSchema = z
  .object({
    type: z.string().trim().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

type LocationDefinitionInput = {
  id: string;
  label: string;
  subtitle: string;
  tags?: string[];
  availableNpcIds: string[];
  sublocations?: LocationDefinitionInput[];
  isReturnable?: boolean;
  entryActionLabel?: string;
  exitActionLabel?: string;
  entryDisabledReason?: string;
  entryGuards?: Array<{ type: string; params?: Record<string, unknown> }>;
  exitGuards?: Array<{ type: string; params?: Record<string, unknown> }>;
  sceneImageId?: string;
};

const locationDefinitionSchema: z.ZodType<LocationDefinitionInput> = z.lazy(() =>
  z
    .object({
      id: definitionIdSchema,
      label: z.string().trim().min(1),
      subtitle: z.string().trim().min(1),
      tags: z.array(tagSchema).optional(),
      availableNpcIds: z.array(definitionIdSchema),
      sublocations: z.array(locationDefinitionSchema).optional(),
      isReturnable: z.boolean().optional(),
      entryActionLabel: z.string().trim().min(1).optional(),
      exitActionLabel: z.string().trim().min(1).optional(),
      entryDisabledReason: z.string().trim().min(1).optional(),
      entryGuards: z.array(locationGuardSchema).optional(),
      exitGuards: z.array(locationGuardSchema).optional(),
      sceneImageId: z.string().trim().min(1).optional(),
    })
    .strict(),
);

export class DefinitionValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "DefinitionValidationError";
  }
}

export class AdminDefinitionValidationService {
  constructor(
    private readonly assetService: DefinitionAssetService,
    private readonly tagRegistryPath: string,
  ) {}

  async validate(
    type: DefinitionType,
    expectedId: string,
    definition: unknown,
  ): Promise<Record<string, unknown>> {
    const normalizedExpectedId = definitionIdSchema.parse(expectedId);

    try {
      const normalized = normalizeDefinitionShape(definition);
      const validated = await validateByType(
        type,
        normalizedExpectedId,
        normalized,
        this.assetService,
      );
      await this.validateTags(type, validated);
      return validated;
    } catch (error) {
      if (error instanceof DefinitionValidationError) {
        throw error;
      }

      if (error instanceof z.ZodError) {
        throw new DefinitionValidationError(
          error.issues.map((issue) => issue.message),
        );
      }

      if (error instanceof Error) {
        throw new DefinitionValidationError([error.message]);
      }

      throw error;
    }
  }

  private async validateTags(
    type: DefinitionType,
    definition: Record<string, unknown>,
  ): Promise<void> {
    const tagValues = collectTagValues(definition);

    const registry = await this.getTagRegistry();
    const canonicalTagByLowercase = new Map<string, string>();

    for (const category of registry.categories) {
      if (!category.allowedFor.includes(type)) {
        continue;
      }

      for (const tag of category.tags) {
        canonicalTagByLowercase.set(tag.id.toLowerCase(), tag.id);
      }
    }

    const invalidTags = tagValues.flatMap((tag) => {
      const parsed = tagSchema.safeParse(tag);
      return parsed.success
        ? []
        : [parsed.error.issues[0]?.message ?? "Invalid tag value."];
    });

    if (invalidTags.length > 0) {
      throw new DefinitionValidationError(invalidTags);
    }

    const unknownTags: string[] = [];
    const caseMismatchTags: string[] = [];

    for (const rawTag of tagValues) {
      if (typeof rawTag !== "string") {
        continue;
      }

      const canonicalTag = canonicalTagByLowercase.get(rawTag.toLowerCase());

      if (!canonicalTag) {
        unknownTags.push(rawTag);
        continue;
      }

      if (canonicalTag !== rawTag) {
        caseMismatchTags.push(`${rawTag} (canonical: ${canonicalTag})`);
      }
    }

    if (unknownTags.length > 0) {
      throw new DefinitionValidationError([
        `Unknown ${type} tags: ${unknownTags.join(", ")}. Use values from /api/tags only.`,
      ]);
    }

    if (caseMismatchTags.length > 0) {
      throw new DefinitionValidationError([
        `Tag casing conflicts for ${type}: ${caseMismatchTags.join(", ")}.`,
      ]);
    }
  }

  private async getTagRegistry(): Promise<TagRegistry> {
    const raw = await readFile(this.tagRegistryPath, "utf8");
    return tagRegistrySchema.parse(JSON.parse(raw) as unknown);
  }
}

function collectTagValues(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTagValues(entry));
  }

  const record = value as Record<string, unknown>;
  const ownTags = Array.isArray(record["tags"])
    ? record["tags"].filter((tag): tag is string => typeof tag === "string")
    : [];

  const nestedTags = Object.values(record).flatMap((entry) => collectTagValues(entry));
  return [...ownTags, ...nestedTags];
}

async function validateByType(
  type: DefinitionType,
  expectedId: string,
  definition: Record<string, unknown>,
  assetService: DefinitionAssetService,
): Promise<Record<string, unknown>> {
  switch (type) {
    case "items":
      return validateItemDefinition(expectedId, definition, assetService);
    case "materials":
      return validateMaterialDefinition(expectedId, definition, assetService);
    case "locations":
      return validateLocationDefinition(expectedId, definition, assetService);
    case "activities":
      return validateActivityDefinition(expectedId, definition);
    case "actions":
      return validateActionDefinition(expectedId, definition);
  }
}

async function validateItemDefinition(
  expectedId: string,
  definition: Record<string, unknown>,
  assetService: DefinitionAssetService,
): Promise<Record<string, unknown>> {
  const normalized = stripLegacyAssetFields(definition, "iconPath");
  const imageId = optionalTrimmedString(normalized["imageId"]);

  delete normalized["imageId"];

  const parsed = inventoryItemDefinitionSchema.parse(normalized) as Record<
    string,
    unknown
  >;

  if (parsed["category"] === "material") {
    throw new DefinitionValidationError([
      'Items endpoint does not accept definitions with category "material".',
    ]);
  }

  validateDefinitionId(parsed, expectedId, "item");

  if (imageId) {
    await assertAssetExists(assetService, "items", imageId);
    parsed["imageId"] = imageId;
  }

  return parsed;
}

async function validateMaterialDefinition(
  expectedId: string,
  definition: Record<string, unknown>,
  assetService: DefinitionAssetService,
): Promise<Record<string, unknown>> {
  const normalized = stripLegacyAssetFields(definition, "iconPath");
  const imageId = optionalTrimmedString(normalized["imageId"]);

  delete normalized["imageId"];

  const parsed = inventoryMaterialItemSchema.parse(normalized) as Record<
    string,
    unknown
  >;
  validateDefinitionId(parsed, expectedId, "material");

  if (imageId) {
    await assertAssetExists(assetService, "materials", imageId);
    parsed["imageId"] = imageId;
  }

  return parsed;
}

async function validateLocationDefinition(
  expectedId: string,
  definition: Record<string, unknown>,
  assetService: DefinitionAssetService,
): Promise<Record<string, unknown>> {
  const normalized = stripSceneImagePaths(definition);
  const parsed = locationDefinitionSchema.parse(normalized);

  if (parsed.id !== expectedId) {
    throw new DefinitionValidationError([
      `Location id "${parsed.id}" must match route id "${expectedId}".`,
    ]);
  }

  await validateLocationAssets(parsed, assetService);
  validateUniqueSublocationIds(parsed.sublocations ?? [], new Set<string>());

  return parsed as unknown as Record<string, unknown>;
}

async function validateActivityDefinition(
  expectedId: string,
  definition: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const normalized = { ...definition };
  const location = locationReferenceSchema.parse(normalized["location"]);
  const questSignal =
    normalized["questSignal"] === undefined
      ? undefined
      : activityQuestSignalSchema.parse(normalized["questSignal"]);

  delete normalized["location"];
  delete normalized["questSignal"];

  const parsed = activityDefinitionSchema.parse(normalized) as Record<
    string,
    unknown
  >;
  validateDefinitionId(parsed, expectedId, "activity");

  parsed["location"] = location;

  if (questSignal) {
    parsed["questSignal"] = questSignal;
  }

  return parsed;
}

async function validateActionDefinition(
  expectedId: string,
  definition: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const parsed = actionDefinitionSchema.parse(definition) as Record<string, unknown>;
  validateDefinitionId(parsed, expectedId, "action");
  return parsed;
}

function validateDefinitionId(
  parsed: Record<string, unknown>,
  expectedId: string,
  label: string,
): void {
  const parsedId = definitionIdSchema.parse(parsed["id"]);

  if (parsedId !== expectedId) {
    throw new DefinitionValidationError([
      `${label} id "${parsedId}" must match route id "${expectedId}".`,
    ]);
  }
}

function normalizeDefinitionShape(definition: unknown): Record<string, unknown> {
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    throw new DefinitionValidationError([
      "Definition payload must be an object.",
    ]);
  }

  return { ...(definition as Record<string, unknown>) };
}

function stripLegacyAssetFields(
  definition: Record<string, unknown>,
  legacyField: "iconPath" | "sceneImagePath",
): Record<string, unknown> {
  const normalized = { ...definition };
  delete normalized[legacyField];
  return normalized;
}

function stripSceneImagePaths(definition: Record<string, unknown>): Record<string, unknown> {
  const normalized = stripLegacyAssetFields(definition, "sceneImagePath");
  const sublocations = Array.isArray(normalized["sublocations"])
    ? normalized["sublocations"].map((entry) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
          return entry;
        }

        const nextEntry = { ...(entry as Record<string, unknown>) };
        delete nextEntry["sceneImagePath"];
        return nextEntry;
      })
    : normalized["sublocations"];

  if (sublocations !== undefined) {
    normalized["sublocations"] = sublocations;
  }

  return normalized;
}

async function validateLocationAssets(
  definition: LocationDefinitionInput,
  assetService: DefinitionAssetService,
): Promise<void> {
  if (definition.sceneImageId) {
    await assertAssetExists(assetService, "locations", definition.sceneImageId);
  }

  for (const sublocation of definition.sublocations ?? []) {
    await validateLocationAssets(sublocation, assetService);
  }
}

function validateUniqueSublocationIds(
  sublocations: readonly LocationDefinitionInput[],
  seenIds: Set<string>,
): void {
  for (const sublocation of sublocations) {
    if (seenIds.has(sublocation.id)) {
      throw new DefinitionValidationError([
        `Duplicate sublocation id "${sublocation.id}" found in location definition.`,
      ]);
    }

    seenIds.add(sublocation.id);
    validateUniqueSublocationIds(sublocation.sublocations ?? [], seenIds);
  }
}

async function assertAssetExists(
  assetService: DefinitionAssetService,
  type: DefinitionType,
  assetId: string,
): Promise<void> {
  const asset = await assetService.getAssetInfo(type, assetId);

  if (!asset) {
    throw new DefinitionValidationError([
      `No ${type} asset found for image id "${assetId}".`,
    ]);
  }
}

function optionalTrimmedString(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
