import type { ResourceId, TagId } from "./combat.ids";

export interface ResourceDefinition {
  id: ResourceId;
  displayName: string;
  max?: number;
  startsAt?: number;
  tags?: TagId[];
}

export interface ResourceChange {
  resourceId: ResourceId;
  amount: number;
}
