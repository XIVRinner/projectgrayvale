# Grayvale Core Modifier Guide

## Purpose

The modifier module provides a small stat pipeline for turning player data and equipment modifiers into a final numeric stat block.
It is intentionally generic so higher-level systems can decide what stats mean.

## Base Contracts

```ts
type Stat = string;

type ModifierType = "add" | "multiply";

interface Modifier {
  stat: Stat;
  type: ModifierType;
  value: number;
}

type StatBlock = Record<string, number>;

interface ModifierSourceItem {
  modifiers?: ReadonlyArray<Modifier>;
}
```

Design constraints:

- stat keys are plain strings
- modifiers are numeric only
- additive and multiplicative steps are separated
- the pipeline never mutates the inputs
- unknown stats can be created from modifiers alone

## Helpers

Core exports:

- `getAttributeModifiers(player)`
- `getSkillModifiers(player)`
- `getEquipmentModifiers(items)`
- `collectModifiers(player, items)`
- `computeFinalStats(baseStats, modifiers)`

Current calculation order:

1. sum all `add` modifiers for each stat
2. multiply the result by the combined `multiply` modifiers for that stat

That means `(base + additiveTotal) * multiplicativeTotal`.

## Example Usage

```ts
import {
  collectModifiers,
  computeFinalStats,
  type ModifierSourceItem
} from "@rinner/grayvale-core";

const equipment: ModifierSourceItem[] = [
  {
    modifiers: [
      { stat: "damage", type: "add", value: 4 },
      { stat: "defense", type: "multiply", value: 1.1 }
    ]
  }
];

const modifiers = collectModifiers(player, equipment);

const finalStats = computeFinalStats(
  { damage: 10, defense: 20 },
  modifiers
);
```

JSON example:

- [`examples/modifiers.json`](../examples/modifiers.json)

## Non-Goals

This module does not handle:

- stat caps
- rounding rules
- elemental formulas
- combat resolution
- registry lookups
