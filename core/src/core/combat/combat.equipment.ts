import type { TagId, ItemId, SkillId, EffectId } from "./combat.ids";
import type { DamageType, DamageInterval } from "./combat.damage";

export type EquipmentSlot =
  | "head"
  | "chest"
  | "gloves"
  | "legs"
  | "boots"
  | "main_hand"
  | "off_hand"
  | "ring";

export type EquipmentLoadout = Partial<Record<EquipmentSlot, ItemId>>;

export interface ItemDefinition {
  id: ItemId;
  displayName: string;
  itemType: "equipment" | "material" | "quest" | "junk";
  tags: TagId[];
}

export interface EquipmentModifier {
  id: string;
  target: string;
  operation: "add" | "multiply";
  value: number;
}

export interface EquipmentDefinition extends ItemDefinition {
  itemType: "equipment";
  slot: EquipmentSlot;
  itemLevel: number;
  levelRequirement?: number;
  skillRequirement?: {
    skillId: SkillId;
    level: number;
  };

  associatedSkill?: SkillId;

  damage?: Partial<Record<DamageType, DamageInterval>>;
  armorSkill?: SkillId;
  armorSlotWeight?: number;

  modifiers?: EquipmentModifier[];
  passives?: EffectId[];
}
