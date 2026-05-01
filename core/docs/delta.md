# Grayvale Core Delta Guide

## Purpose

The delta module applies small immutable state changes to a Grayvale game state.
It is designed for deterministic state updates driven by external systems such as quests, activities, or progression handlers.

## Base Contracts

```ts
type DeltaOperation = "set" | "add";

type DeltaTarget = "player" | "npc";

type DeltaValue = number | string | boolean | null;

type Delta = {
  type: DeltaOperation;
  target: DeltaTarget;
  targetId?: string;
  path: string[];
  value: DeltaValue;
  meta?: Record<string, unknown>;
};

type GameState = {
  player: Player;
  npcs: Record<string, NPC>;
};
```

Design constraints:

- deltas are plain serializable objects
- updates are path-based rather than hardcoded per field
- application is immutable
- `npc` deltas require `targetId`
- `add` only works with numeric values

## Helpers

Core exports:

- `applyDelta(state, delta)`
- `applyDeltas(state, deltas)`

Current behavior:

- empty paths throw
- missing nested objects are created as needed
- `set` replaces the value at the target path
- `add` initializes missing numeric values from the delta value
- `add` throws when used against a non-numeric existing value
- unchanged branches preserve reference equality

## Example Usage

```ts
import { applyDelta, applyDeltas, type GameState } from "@rinner/grayvale-core";

const next = applyDelta(state, {
  type: "add",
  target: "player",
  path: ["skills", "mining"],
  value: 0.5
});

const batch = applyDeltas(next, [
  {
    type: "set",
    target: "npc",
    targetId: "npc_1",
    path: ["equipment", "mainHand"],
    value: "iron_sword"
  },
  {
    type: "add",
    target: "npc",
    targetId: "npc_1",
    path: ["trust"],
    value: 5
  }
]);
```

JSON example:

- [`examples/delta.json`](../examples/delta.json)

## Non-Goals

This module does not handle:

- schema validation
- gameplay meaning of a delta
- conflict resolution across parallel systems
- audit storage or persistence
