import {
  CHANGELOG_AUDIENCES,
  CHANGELOG_ENTRY_TYPES,
  CHANGELOG_IMPACTS,
  RELEASE_STATUSES,
  type ChangelogAudience,
  type ChangelogEntryType,
  type ChangelogImpact,
  type ReleaseStatus,
} from "@rinner/grayvale-core";
import { z } from "zod";

const limitSchema = z.coerce.number().int().min(1).max(50).default(10);
const releaseIdSchema = z.string().trim().min(1).max(120);
const clientIdSchema = z.string().trim().min(1).max(120);
const versionSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, {
    message:
      "Version may only contain letters, numbers, dots, underscores, and hyphens.",
  });
const titleSchema = z.string().trim().min(1).max(160);
const summarySchema = z.string().trim().min(1).max(500).optional();
const bodySchema = z.string().trim().min(1).max(4_000).optional();
const tagSchema = z.string().trim().min(1).max(40);
const sortOrderSchema = z.number().int().min(0).max(10_000).optional();
const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid ISO date-time string.",
  });

const queryValue = (raw: unknown): string | undefined => {
  if (Array.isArray(raw)) {
    return queryValue(raw[0]);
  }

  return typeof raw === "string" ? raw : undefined;
};

const listQuerySchema = z.object({
  limit: z.preprocess(queryValue, limitSchema.optional()),
  type: z.preprocess(queryValue, z.enum(CHANGELOG_ENTRY_TYPES).optional()),
  audience: z.preprocess(queryValue, z.enum(CHANGELOG_AUDIENCES).optional()),
  since: z.preprocess(queryValue, isoDateTimeSchema.optional()),
  tag: z.preprocess(queryValue, tagSchema.optional()),
  clientId: z.preprocess(queryValue, clientIdSchema.optional()),
});

const createReleaseSchema = z.object({
  version: versionSchema,
  title: titleSchema,
  summary: summarySchema,
  status: z.enum(RELEASE_STATUSES).optional(),
});

const updateReleaseSchema = z
  .object({
    version: versionSchema.optional(),
    title: titleSchema.optional(),
    summary: summarySchema.or(z.literal("")).optional(),
    status: z.enum(RELEASE_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one release field must be provided.",
  });

const entryPayloadSchema = z.object({
  type: z.enum(CHANGELOG_ENTRY_TYPES),
  title: titleSchema,
  body: bodySchema,
  audience: z.enum(CHANGELOG_AUDIENCES).default("user"),
  impact: z.enum(CHANGELOG_IMPACTS).default("low"),
  tags: z.array(tagSchema).max(20).default([]),
  sortOrder: sortOrderSchema,
});

const updateEntrySchema = z
  .object({
    type: z.enum(CHANGELOG_ENTRY_TYPES).optional(),
    title: titleSchema.optional(),
    body: bodySchema.or(z.literal("")).optional(),
    audience: z.enum(CHANGELOG_AUDIENCES).optional(),
    impact: z.enum(CHANGELOG_IMPACTS).optional(),
    tags: z.array(tagSchema).max(20).optional(),
    sortOrder: sortOrderSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one changelog entry field must be provided.",
  });

const markReadSchema = z
  .object({
    releaseId: releaseIdSchema,
    clientId: clientIdSchema.optional(),
  })
  .refine((value) => value.clientId !== undefined || value.releaseId.length > 0, {
    message: "releaseId is required.",
  });

export type ChangelogListQuery = {
  readonly limit: number;
  readonly type?: ChangelogEntryType;
  readonly audience?: ChangelogAudience;
  readonly since?: string;
  readonly tag?: string;
  readonly clientId?: string;
};

export interface CreateReleaseInput {
  readonly version: string;
  readonly title: string;
  readonly summary?: string;
  readonly status?: ReleaseStatus;
}

export interface UpdateReleaseInput {
  readonly version?: string;
  readonly title?: string;
  readonly summary?: string | null;
  readonly status?: ReleaseStatus;
}

export interface CreateEntryInput {
  readonly type: ChangelogEntryType;
  readonly title: string;
  readonly body?: string;
  readonly audience: ChangelogAudience;
  readonly impact: ChangelogImpact;
  readonly tags: readonly string[];
  readonly sortOrder?: number;
}

export interface UpdateEntryInput {
  readonly type?: ChangelogEntryType;
  readonly title?: string;
  readonly body?: string | null;
  readonly audience?: ChangelogAudience;
  readonly impact?: ChangelogImpact;
  readonly tags?: readonly string[];
  readonly sortOrder?: number;
}

export interface MarkReleaseReadInput {
  readonly releaseId: string;
  readonly clientId?: string;
}

export type ReleaseFragmentInput = CreateEntryInput;

export function parseChangelogListQuery(
  query: unknown,
  defaultLimit?: number,
): ChangelogListQuery {
  const parsed = listQuerySchema.parse(query);

  return {
    ...parsed,
    limit: parsed.limit ?? defaultLimit ?? 10,
  };
}

export function parseUnreadCountQuery(query: unknown): { readonly clientId?: string } {
  const parsed = listQuerySchema.pick({ clientId: true }).parse(query);
  return {
    clientId: parsed.clientId,
  };
}

export function parseCreateReleaseBody(body: unknown): CreateReleaseInput {
  const parsed = createReleaseSchema.parse(body);

  return {
    version: parsed.version,
    title: parsed.title,
    summary: normalizeOptionalText(parsed.summary),
    status: parsed.status,
  };
}

export function parseUpdateReleaseBody(body: unknown): UpdateReleaseInput {
  const parsed = updateReleaseSchema.parse(body);

  return {
    version: parsed.version,
    title: parsed.title,
    summary: normalizeOptionalText(parsed.summary),
    status: parsed.status,
  };
}

export function parseCreateEntryBody(body: unknown): CreateEntryInput {
  const parsed = entryPayloadSchema.parse(body);
  return normalizeEntryPayload(parsed);
}

export function parseUpdateEntryBody(body: unknown): UpdateEntryInput {
  const parsed = updateEntrySchema.parse(body);

  return {
    type: parsed.type,
    title: parsed.title,
    body: normalizeNullableText(parsed.body),
    audience: parsed.audience,
    impact: parsed.impact,
    tags: parsed.tags,
    sortOrder: parsed.sortOrder,
  };
}

export function parseMarkReadBody(body: unknown): MarkReleaseReadInput {
  const parsed = markReadSchema.parse(body);

  return {
    releaseId: parsed.releaseId,
    clientId: parsed.clientId,
  };
}

export function parseReleaseFragment(body: unknown): ReleaseFragmentInput {
  return normalizeEntryPayload(entryPayloadSchema.parse(body));
}

export function parseReleaseIdParam(raw: unknown): string {
  return releaseIdSchema.parse(raw);
}

export function parseEntryIdParam(raw: unknown): string {
  return releaseIdSchema.parse(raw);
}

function normalizeEntryPayload(parsed: z.infer<typeof entryPayloadSchema>): CreateEntryInput {
  return {
    type: parsed.type,
    title: parsed.title,
    body: normalizeOptionalText(parsed.body),
    audience: parsed.audience,
    impact: parsed.impact,
    tags: parsed.tags,
    sortOrder: parsed.sortOrder,
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableText(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
