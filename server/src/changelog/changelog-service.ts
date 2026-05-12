import type { ChangelogEntry, ChangelogRelease, ChangelogResponse } from "@rinner/grayvale-core";

import type {
  ChangelogViewerContext,
  ChangelogRepository,
} from "./changelog-repository";
import type {
  ChangelogListQuery,
  CreateEntryInput,
  CreateReleaseInput,
  MarkReleaseReadInput,
  UpdateEntryInput,
  UpdateReleaseInput,
} from "./changelog-validation";

export interface ChangelogAdminContext extends ChangelogViewerContext {
  readonly isAdmin: boolean;
}

export class ChangelogServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export class ChangelogService {
  constructor(private readonly repository: ChangelogRepository) {}

  async listPublishedReleases(
    filters: ChangelogListQuery,
    viewer: ChangelogViewerContext,
  ): Promise<ChangelogResponse> {
    const [releases, totalReleases] = await Promise.all([
      this.repository.listPublishedReleases(filters, viewer),
      this.repository.countPublishedReleases(filters, viewer),
    ]);

    return {
      releases,
      totalReleases,
    };
  }

  async latestPublishedReleases(
    filters: ChangelogListQuery,
    viewer: ChangelogViewerContext,
  ): Promise<ChangelogResponse> {
    return this.listPublishedReleases(
      {
        ...filters,
        limit: filters.limit || 1,
      },
      viewer,
    );
  }

  async countUnreadPublishedReleases(viewer: {
    readonly userId?: string;
    readonly clientId?: string;
  }): Promise<number> {
    if (!viewer.userId && !viewer.clientId) {
      throw new ChangelogServiceError(
        "A signed-in user or anonymous clientId is required.",
        400,
        "missing_reader_identity",
      );
    }

    return this.repository.countUnreadPublishedReleases(viewer);
  }

  async markReleaseRead(
    input: MarkReleaseReadInput,
    viewer: {
      readonly userId?: string;
    },
  ): Promise<void> {
    const identity = {
      userId: viewer.userId,
      clientId: viewer.userId ? undefined : input.clientId,
    };

    if (!identity.userId && !identity.clientId) {
      throw new ChangelogServiceError(
        "A signed-in user or anonymous clientId is required to mark a release as read.",
        400,
        "missing_reader_identity",
      );
    }

    const release = await this.repository.getReleaseRecordById(input.releaseId);

    if (!release || release.status !== "published") {
      throw new ChangelogServiceError(
        "Published release not found.",
        404,
        "release_not_found",
      );
    }

    await this.repository.markReleaseRead({
      releaseId: input.releaseId,
      ...identity,
    });
  }

  async createRelease(
    input: CreateReleaseInput,
    context: ChangelogAdminContext,
  ): Promise<ChangelogRelease> {
    this.assertAdmin(context);

    if (input.status === "published") {
      throw new ChangelogServiceError(
        "Create the release as draft, then publish it after entries exist.",
        400,
        "publish_requires_entries",
      );
    }

    const existing = await this.repository.getReleaseRecordByVersion(input.version);

    if (existing) {
      throw new ChangelogServiceError(
        `Release version "${input.version}" already exists.`,
        409,
        "release_version_exists",
      );
    }

    try {
      return await this.repository.createRelease(input);
    } catch (error) {
      if (isUniqueVersionError(error)) {
        throw new ChangelogServiceError(
          `Release version "${input.version}" already exists.`,
          409,
          "release_version_exists",
        );
      }

      throw error;
    }
  }

  async updateRelease(
    releaseId: string,
    input: UpdateReleaseInput,
    context: ChangelogAdminContext,
  ): Promise<ChangelogRelease> {
    this.assertAdmin(context);

    const existing = await this.repository.getReleaseRecordById(releaseId);

    if (!existing) {
      throw new ChangelogServiceError("Release not found.", 404, "release_not_found");
    }

    if (input.status === "published") {
      throw new ChangelogServiceError(
        "Use the publish endpoint to publish a release.",
        400,
        "publish_requires_entries",
      );
    }

    if (input.version && input.version !== existing.version) {
      const conflicting = await this.repository.getReleaseRecordByVersion(input.version);

      if (conflicting && conflicting.id !== releaseId) {
        throw new ChangelogServiceError(
          `Release version "${input.version}" already exists.`,
          409,
          "release_version_exists",
        );
      }
    }

    const updated = await this.repository.updateRelease(releaseId, input);

    if (!updated) {
      throw new ChangelogServiceError("Release not found.", 404, "release_not_found");
    }

    return updated;
  }

  async deleteRelease(
    releaseId: string,
    context: ChangelogAdminContext,
  ): Promise<void> {
    this.assertAdmin(context);

    const deleted = await this.repository.deleteRelease(releaseId);

    if (!deleted) {
      throw new ChangelogServiceError("Release not found.", 404, "release_not_found");
    }
  }

  async createEntry(
    releaseId: string,
    input: CreateEntryInput,
    context: ChangelogAdminContext,
  ): Promise<ChangelogEntry> {
    this.assertAdmin(context);

    const release = await this.repository.getReleaseRecordById(releaseId);

    if (!release) {
      throw new ChangelogServiceError("Release not found.", 404, "release_not_found");
    }

    return this.repository.createEntry(releaseId, input);
  }

  async updateEntry(
    entryId: string,
    input: UpdateEntryInput,
    context: ChangelogAdminContext,
  ): Promise<ChangelogEntry> {
    this.assertAdmin(context);

    const updated = await this.repository.updateEntry(entryId, input);

    if (!updated) {
      throw new ChangelogServiceError(
        "Changelog entry not found.",
        404,
        "entry_not_found",
      );
    }

    return updated;
  }

  async deleteEntry(
    entryId: string,
    context: ChangelogAdminContext,
  ): Promise<void> {
    this.assertAdmin(context);

    const deleted = await this.repository.deleteEntry(entryId);

    if (!deleted) {
      throw new ChangelogServiceError(
        "Changelog entry not found.",
        404,
        "entry_not_found",
      );
    }
  }

  async publishRelease(
    releaseId: string,
    context: ChangelogAdminContext,
  ): Promise<ChangelogRelease> {
    this.assertAdmin(context);

    const release = await this.repository.getReleaseRecordById(releaseId);

    if (!release) {
      throw new ChangelogServiceError("Release not found.", 404, "release_not_found");
    }

    const entryCount = await this.repository.countEntriesForRelease(releaseId);

    if (entryCount === 0) {
      throw new ChangelogServiceError(
        "A release must contain at least one changelog entry before publishing.",
        422,
        "release_requires_entries",
      );
    }

    const published = await this.repository.publishRelease(
      releaseId,
      new Date().toISOString(),
    );

    if (!published) {
      throw new ChangelogServiceError("Release not found.", 404, "release_not_found");
    }

    return published;
  }

  private assertAdmin(context: ChangelogAdminContext): void {
    if (!context.isAdmin) {
      throw new ChangelogServiceError(
        "Admin access is required.",
        403,
        "forbidden",
      );
    }
  }
}

function isUniqueVersionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: releases.version")
  );
}
