export interface JsonResourceRecord {
  readonly resourceKey: string;
  readonly sourcePath: string;
  readonly payload: string;
  readonly checksum: string;
  readonly updatedAt: string;
}

export interface SeededJsonResource {
  readonly resourceKey: string;
  readonly sourcePath: string;
  readonly payload: unknown;
  readonly rawPayload: string;
  readonly checksum: string;
}
