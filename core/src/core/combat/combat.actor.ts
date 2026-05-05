import type { ActorId, SkillId, AbilityId, TagId } from "./combat.ids";
import type { ResistanceProfile, ImmunityProfile } from "./combat.resistance";
import type { ResourceDefinition } from "./combat.resource";
import type { EquipmentLoadout } from "./combat.equipment";

export interface ActorDefinition {
  id: ActorId;
  displayName: string;
  level: number;
  maxHp: number;
  tags: TagId[];

  resources?: ResourceDefinition[];
  abilities?: AbilityId[];

  resistances?: ResistanceProfile;
  immunities?: ImmunityProfile;

  dodgeChance?: number;

  equipment?: EquipmentLoadout;
  skills?: SkillId[];
}
