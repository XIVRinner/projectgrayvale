import type { SkillId, AbilityId, TagId } from "./combat.ids";

export interface SkillDefinition {
  id: SkillId;
  displayName: string;
  tags: TagId[];
  defaultRotationId?: string;
  abilityIds: AbilityId[];
}
