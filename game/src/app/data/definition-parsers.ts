import {
  actionDefinitionSchema,
  activityDefinitionSchema,
  inventoryEquipmentItemSchema,
  inventoryItemDefinitionSchema,
  inventoryMaterialItemSchema,
  type ActivityDefinition,
  type DamageInterval,
  type DamageType,
  type InventoryEquipmentItem,
  type InventoryItemDefinition,
  type InventoryMaterialItem,
} from "@rinner/grayvale-core";
import { z } from "zod";

export type GameDefinitionImageFields = {
  imageId?: string;
  iconPath?: string;
};

export type GameInventoryItemDefinition = InventoryItemDefinition & GameDefinitionImageFields & {
  damage?: Partial<Record<DamageType, DamageInterval>>;
};

export type GameInventoryEquipmentItem = InventoryEquipmentItem & GameDefinitionImageFields & {
  damage?: Partial<Record<DamageType, DamageInterval>>;
};

export type GameInventoryMaterialItem = InventoryMaterialItem & GameDefinitionImageFields;
export type GameActionDefinition = z.infer<typeof actionDefinitionSchema>;

const damageIntervalSchema = z
  .object({
    min: z.number().int(),
    max: z.number().int(),
  })
  .strict()
  .refine((value) => value.min <= value.max, {
    message: "Damage interval min cannot be greater than max.",
  });

const itemDamageProfileSchema = z
  .object({
    slashing: damageIntervalSchema.optional(),
    piercing: damageIntervalSchema.optional(),
    thrusting: damageIntervalSchema.optional(),
    blunt: damageIntervalSchema.optional(),
    nature: damageIntervalSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Damage profile must define at least one damage interval.",
  });

export function parseInventoryItemDefinition(raw: unknown): GameInventoryItemDefinition {
  const record = extractGameImageFields(raw);
  const isEquipment = isPlainObject(record.payload) && record.payload["category"] === "equipment";
  const damage =
    isEquipment && "damage" in (record.payload as Record<string, unknown>)
      ? itemDamageProfileSchema.parse((record.payload as Record<string, unknown>)["damage"])
      : undefined;

  if (isPlainObject(record.payload) && isEquipment) {
    delete record.payload["damage"];
  }

  const parsed = inventoryItemDefinitionSchema.parse(record.payload) as GameInventoryItemDefinition;

  return attachGameImageFields(parsed, record.imageId, record.iconPath, damage);
}

export function parseInventoryItemDefinitions(raw: unknown): GameInventoryItemDefinition[] {
  return ensureArray(raw, "inventory item definitions").map((entry) => parseInventoryItemDefinition(entry));
}

export function parseEquipmentItemDefinition(raw: unknown): GameInventoryEquipmentItem {
  const record = extractGameImageFields(raw);
  const damage =
    isPlainObject(record.payload) && "damage" in record.payload
      ? itemDamageProfileSchema.parse(record.payload["damage"])
      : undefined;

  if (isPlainObject(record.payload)) {
    delete record.payload["damage"];
  }

  const parsed = inventoryEquipmentItemSchema.parse(record.payload) as GameInventoryEquipmentItem;

  return attachGameImageFields(parsed, record.imageId, record.iconPath, damage);
}

export function parseEquipmentItemDefinitions(raw: unknown): GameInventoryEquipmentItem[] {
  return ensureArray(raw, "equipment item definitions").map((entry) => parseEquipmentItemDefinition(entry));
}

export function parseMaterialDefinition(raw: unknown): GameInventoryMaterialItem {
  const record = extractGameImageFields(raw);
  const parsed = inventoryMaterialItemSchema.parse(record.payload) as GameInventoryMaterialItem;
  return attachGameImageFields(parsed, record.imageId, record.iconPath);
}

export function parseActivityDefinition(raw: unknown): ActivityDefinition {
  return activityDefinitionSchema.parse(raw);
}

export function parseActionDefinition(raw: unknown): GameActionDefinition {
  return actionDefinitionSchema.parse(raw);
}

function extractGameImageFields(raw: unknown): {
  payload: unknown;
  imageId?: string;
  iconPath?: string;
} {
  const record = isPlainObject(raw) ? { ...raw } : raw;
  const imageId = isPlainObject(record) && typeof record["imageId"] === "string" ? record["imageId"] : undefined;
  const iconPath = isPlainObject(record) && typeof record["iconPath"] === "string" ? record["iconPath"] : undefined;

  if (isPlainObject(record)) {
    delete record["imageId"];
    delete record["iconPath"];
  }

  return { payload: record, imageId, iconPath };
}

function attachGameImageFields<T extends object>(
  parsed: T,
  imageId?: string,
  iconPath?: string,
  damage?: Partial<Record<DamageType, DamageInterval>>,
): T & GameDefinitionImageFields & { damage?: Partial<Record<DamageType, DamageInterval>> } {
  const nextParsed = parsed as T & GameDefinitionImageFields & {
    damage?: Partial<Record<DamageType, DamageInterval>>;
  };

  if (imageId) {
    nextParsed.imageId = imageId;
  }

  if (iconPath) {
    nextParsed.iconPath = iconPath;
  }

  if (damage) {
    nextParsed.damage = damage;
  }

  return nextParsed;
}

function ensureArray(raw: unknown, label: string): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
