import {
  type DamageInterval,
  type DamageType,
  type InventoryEquipmentItem,
  type InventoryItemDefinition
} from "@rinner/grayvale-core";
import { z } from "zod";

type ParsedWithOptionalIcon<T extends object> = T & { iconPath?: string };
type ParsedWithOptionalIconAndDamage<T extends object> = ParsedWithOptionalIcon<T> & {
  damage?: Partial<Record<DamageType, DamageInterval>>;
};

const damageIntervalSchema = z
  .object({
    min: z.number().int(),
    max: z.number().int()
  })
  .strict()
  .refine((value) => value.min <= value.max, {
    message: "Damage interval min cannot be greater than max."
  });

const itemDamageProfileSchema = z
  .object({
    slashing: damageIntervalSchema.optional(),
    piercing: damageIntervalSchema.optional(),
    thrusting: damageIntervalSchema.optional(),
    blunt: damageIntervalSchema.optional(),
    nature: damageIntervalSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Damage profile must define at least one damage interval."
  });

export function parseItemArrayWithIconPath<T extends object>(
  raw: unknown,
  parseItem: (value: unknown) => T
): ParsedWithOptionalIcon<T>[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected an item array.");
  }

  return raw.map((entry) => parseItemWithIconPath(entry, parseItem));
}

export function parseItemWithIconPath<T extends object>(
  raw: unknown,
  parseItem: (value: unknown) => T
): ParsedWithOptionalIcon<T> {
  const record = isPlainObject(raw) ? { ...raw } : raw;
  const iconPath =
    isPlainObject(record) && typeof record["iconPath"] === "string" ? record["iconPath"] : undefined;

  if (isPlainObject(record) && "iconPath" in record) {
    delete record["iconPath"];
  }

  const parsed = parseItem(record) as ParsedWithOptionalIcon<T>;

  if (iconPath) {
    parsed.iconPath = iconPath;
  }

  return parsed;
}

export function parseEquipmentItemArrayWithGameFields(
  raw: unknown,
  parseItem: (value: unknown) => InventoryEquipmentItem
): ParsedWithOptionalIconAndDamage<InventoryEquipmentItem>[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected an item array.");
  }

  return raw.map((entry) => parseEquipmentItemWithGameFields(entry, parseItem));
}

export function parseEquipmentItemWithGameFields(
  raw: unknown,
  parseItem: (value: unknown) => InventoryEquipmentItem
): ParsedWithOptionalIconAndDamage<InventoryEquipmentItem> {
  const record = isPlainObject(raw) ? { ...raw } : raw;
  const iconPath =
    isPlainObject(record) && typeof record["iconPath"] === "string" ? record["iconPath"] : undefined;
  const damage = isPlainObject(record) && "damage" in record
    ? itemDamageProfileSchema.parse(record["damage"])
    : undefined;

  if (isPlainObject(record)) {
    delete record["iconPath"];
    delete record["damage"];
  }

  const parsed = parseItem(record) as ParsedWithOptionalIconAndDamage<InventoryEquipmentItem>;

  if (iconPath) {
    parsed.iconPath = iconPath;
  }

  if (damage) {
    parsed.damage = damage;
  }

  return parsed;
}

export function parseInventoryItemArrayWithGameFields(
  raw: unknown,
  parseItem: (value: unknown) => InventoryItemDefinition
): ParsedWithOptionalIconAndDamage<InventoryItemDefinition>[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected an item array.");
  }

  return raw.map((entry) => parseInventoryItemWithGameFields(entry, parseItem));
}

export function parseInventoryItemWithGameFields(
  raw: unknown,
  parseItem: (value: unknown) => InventoryItemDefinition
): ParsedWithOptionalIconAndDamage<InventoryItemDefinition> {
  const record = isPlainObject(raw) ? { ...raw } : raw;
  const iconPath =
    isPlainObject(record) && typeof record["iconPath"] === "string" ? record["iconPath"] : undefined;
  const isEquipment = isPlainObject(record) && record["category"] === "equipment";
  const damage =
    isEquipment && "damage" in (record as Record<string, unknown>)
      ? itemDamageProfileSchema.parse((record as Record<string, unknown>)["damage"])
      : undefined;

  if (isPlainObject(record)) {
    delete record["iconPath"];

    if (isEquipment) {
      delete record["damage"];
    }
  }

  const parsed = parseItem(record) as ParsedWithOptionalIconAndDamage<InventoryItemDefinition>;

  if (iconPath) {
    parsed.iconPath = iconPath;
  }

  if (damage && parsed.category === "equipment") {
    parsed.damage = damage;
  }

  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
