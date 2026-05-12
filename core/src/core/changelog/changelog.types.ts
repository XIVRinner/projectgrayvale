export const RELEASE_STATUSES = ["draft", "published"] as const;

export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const CHANGELOG_ENTRY_TYPES = [
  "added",
  "changed",
  "fixed",
  "removed",
  "security",
  "deprecated",
] as const;

export type ChangelogEntryType = (typeof CHANGELOG_ENTRY_TYPES)[number];

export const CHANGELOG_AUDIENCES = [
  "user",
  "admin",
  "developer",
  "internal",
] as const;

export type ChangelogAudience = (typeof CHANGELOG_AUDIENCES)[number];

export const CHANGELOG_IMPACTS = ["low", "medium", "high"] as const;

export type ChangelogImpact = (typeof CHANGELOG_IMPACTS)[number];

export interface ChangelogEntry {
  readonly id: string;
  readonly releaseId: string;
  readonly type: ChangelogEntryType;
  readonly title: string;
  readonly body?: string;
  readonly audience: ChangelogAudience;
  readonly impact: ChangelogImpact;
  readonly tags: readonly string[];
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChangelogRelease {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly summary?: string;
  readonly status: ReleaseStatus;
  readonly releasedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isRead: boolean;
  readonly entries: readonly ChangelogEntry[];
}

export interface ChangelogResponse {
  readonly releases: readonly ChangelogRelease[];
  readonly totalReleases: number;
}
