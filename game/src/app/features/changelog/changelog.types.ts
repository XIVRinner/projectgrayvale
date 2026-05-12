export {
  CHANGELOG_AUDIENCES,
  CHANGELOG_ENTRY_TYPES,
  CHANGELOG_IMPACTS,
  RELEASE_STATUSES,
  type ChangelogAudience,
  type ChangelogEntry,
  type ChangelogEntryType,
  type ChangelogImpact,
  type ChangelogRelease,
  type ChangelogResponse,
  type ReleaseStatus,
} from "@rinner/grayvale-core";

import type { ChangelogAudience, ChangelogEntryType } from "@rinner/grayvale-core";

export type ChangelogTypeFilter = ChangelogEntryType | "all";

export interface ChangelogQueryOptions {
  readonly limit?: number;
  readonly type?: ChangelogEntryType;
  readonly audience?: ChangelogAudience;
  readonly since?: string;
  readonly tag?: string;
}
