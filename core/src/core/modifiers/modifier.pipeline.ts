import type { Player } from "../models";
import type {
  LabeledModifier,
  Modifier,
  ModifierSourceItem,
  StatBlock,
  StatBreakdown,
  StatDisplayState
} from "./modifier.types";

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

const computeActiveValue = (
  base: number,
  activeModifiers: ReadonlyArray<Modifier>
): number => {
  let additiveTotal = 0;
  let multiplicativeTotal = 1;

  for (const modifier of activeModifiers) {
    if (modifier.type === "add") {
      additiveTotal += modifier.value;
    } else {
      multiplicativeTotal *= modifier.value;
    }
  }

  return (base + additiveTotal) * multiplicativeTotal;
};

const resolveDisplayState = (
  base: number,
  activeFinal: number,
  activeModifiers: ReadonlyArray<LabeledModifier>,
  allModifiers: ReadonlyArray<LabeledModifier>
): StatDisplayState => {
  if (activeFinal > base) {
    if (activeModifiers.some((m) => m.special)) {
      return "special";
    }

    return "buffed";
  }

  if (activeFinal < base) {
    return "nerfed";
  }

  if (allModifiers.some((m) => !m.active)) {
    return "muted";
  }

  return "neutral";
};

export const computeStatBreakdown = (
  stat: string,
  base: number,
  modifiers: ReadonlyArray<LabeledModifier>
): StatBreakdown => {
  const activeModifiers = modifiers.filter((m) => m.active);
  const final = computeActiveValue(base, activeModifiers);
  const displayState = resolveDisplayState(base, final, activeModifiers, modifiers);

  return { stat, base, modifiers, final, displayState };
};

export const computeStatBreakdowns = (
  baseStats: StatBlock,
  modifiers: ReadonlyArray<LabeledModifier>
): Record<string, StatBreakdown> => {
  const statKeys = new Set<string>([
    ...Object.keys(baseStats),
    ...modifiers.map((m) => m.stat)
  ]);

  const result: Record<string, StatBreakdown> = {};

  for (const stat of statKeys) {
    const base = baseStats[stat] ?? 0;
    const statModifiers = modifiers.filter((m) => m.stat === stat);
    result[stat] = computeStatBreakdown(stat, base, statModifiers);
  }

  return result;
};
