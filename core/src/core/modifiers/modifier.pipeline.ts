import type { Player } from "../models";
import type { Modifier, ModifierSourceItem, StatBlock } from "./modifier.types";

const mapRecordToAddModifiers = (values: Record<string, number>): Modifier[] =>
  Object.entries(values).map(([stat, value]) => ({
    stat,
    type: "add",
    value
  }));

export const getAttributeModifiers = (player: Player): Modifier[] =>
  mapRecordToAddModifiers(player.attributes);

export const getSkillModifiers = (player: Player): Modifier[] =>
  mapRecordToAddModifiers(player.skills);

export const getEquipmentModifiers = (
  equipmentItems: ReadonlyArray<ModifierSourceItem>
): Modifier[] =>
  equipmentItems.flatMap((item) =>
    (item.modifiers ?? []).map((modifier) => ({
      ...modifier
    }))
  );

export const collectModifiers = (
  player: Player,
  equippedItems: ReadonlyArray<ModifierSourceItem>
): Modifier[] => [
  ...getAttributeModifiers(player),
  ...getSkillModifiers(player),
  ...getEquipmentModifiers(equippedItems)
];

export const computeFinalStats = (
  baseStats: StatBlock,
  modifiers: ReadonlyArray<Modifier>
): StatBlock => {
  const additiveTotals: StatBlock = {};
  const multiplicativeTotals: StatBlock = {};
  const stats = new Set<string>(Object.keys(baseStats));

  for (const modifier of modifiers) {
    stats.add(modifier.stat);

    if (modifier.type === "add") {
      additiveTotals[modifier.stat] = (additiveTotals[modifier.stat] ?? 0) + modifier.value;
      continue;
    }

    multiplicativeTotals[modifier.stat] =
      (multiplicativeTotals[modifier.stat] ?? 1) * modifier.value;
  }

  const finalStats: StatBlock = {};

  for (const stat of stats) {
    const baseValue = baseStats[stat] ?? 0;
    const additiveValue = additiveTotals[stat] ?? 0;
    const multiplicativeValue = multiplicativeTotals[stat] ?? 1;

    finalStats[stat] = (baseValue + additiveValue) * multiplicativeValue;
  }

  return finalStats;
};
