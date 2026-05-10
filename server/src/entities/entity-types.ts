export interface ExtractedApiEntity {
  readonly entityType: string;
  readonly entityId: string;
  readonly resourceKey: string;
  readonly displayName?: string;
  readonly category?: string;
  readonly slot?: string;
  readonly locationId?: string;
  readonly sublocationId?: string;
  readonly sortKey: number;
  readonly tags: readonly string[];
  readonly payload: unknown;
  readonly checksum: string;
}

export interface ApiEntityRecord {
  readonly entityType: string;
  readonly entityId: string;
  readonly resourceKey: string;
  readonly displayName?: string;
  readonly category?: string;
  readonly slot?: string;
  readonly locationId?: string;
  readonly sublocationId?: string;
  readonly sortKey: number;
  readonly payload: string;
  readonly checksum: string;
  readonly updatedAt: string;
}

export interface EntityListFilters {
  readonly tag?: string;
  readonly category?: string;
  readonly slot?: string;
  readonly locationId?: string;
  readonly limit?: number;
  readonly offset?: number;
}
