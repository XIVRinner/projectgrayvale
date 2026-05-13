export const definitionTypes = [
  "items",
  "materials",
  "locations",
  "activities",
  "actions",
] as const;

export type DefinitionType = (typeof definitionTypes)[number];

export interface SyncedDefinition {
  readonly type: DefinitionType;
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly json: string;
  readonly sourcePath: string;
}

export interface DefinitionRecord extends SyncedDefinition {
  readonly updatedAt: string;
}

export interface DefinitionMetadata {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly updatedAt: string;
}

export interface HydratedDefinition<TDefinition = unknown> extends DefinitionMetadata {
  readonly definition: TDefinition;
}
