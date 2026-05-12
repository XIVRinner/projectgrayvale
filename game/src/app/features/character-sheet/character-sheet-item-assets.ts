export type {
  GameInventoryEquipmentItem,
  GameInventoryItemDefinition,
} from "../../data/definition-parsers";

import {
  parseEquipmentItemDefinition,
  parseInventoryItemDefinition,
} from "../../data/definition-parsers";

export function parseEquipmentItemWithGameFields<T>(raw: unknown, _parseItem: (value: unknown) => T): T {
  return parseEquipmentItemDefinition(raw) as T;
}

export function parseEquipmentItemArrayWithGameFields<T>(
  raw: unknown,
  _parseItem: (value: unknown) => T
): T[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected an item array.");
  }

  return raw.map((entry) => parseEquipmentItemDefinition(entry) as T);
}

export function parseInventoryItemWithGameFields<T>(raw: unknown, _parseItem: (value: unknown) => T): T {
  return parseInventoryItemDefinition(raw) as T;
}

export function parseInventoryItemArrayWithGameFields<T>(
  raw: unknown,
  _parseItem: (value: unknown) => T
): T[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected an item array.");
  }

  return raw.map((entry) => parseInventoryItemDefinition(entry) as T);
}
