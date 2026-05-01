# Grayvale Core Activity Guide

## Purpose

Grayvale now uses two related activity concepts in Core:

- `ActivityDefinition` for authored activity metadata
- `Activity` for generic bus-safe event payloads

This keeps authored content and runtime messaging aligned without hardcoding gameplay logic into Core.

## Base Contracts

```ts
type Activity = {
  type: string;
  payload?: Record<string, unknown>;
};

interface ActivityDefinition {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  governingAttributes: string[];
  difficulty: number;
  itemId?: string;
}

type ActivityTickDelta = {
  type: "activity_tick";
  payload: {
    activityId: string;
    difficulty: number;
    governingAttributes: string[];
    tags: string[];
    tickDelta: number;
    itemId?: string;
  };
};
```

Design constraints:

- all shapes remain plain JSON-safe data
- `ActivityDefinition` is metadata only, not gameplay behavior
- `difficulty` is a plain numeric value on the activity itself
- `itemId` is an optional attached item reference
- `ActivityTickDelta` is the typed per-tick message for downstream systems such as quests

## What Each Shape Is For

Use `ActivityDefinition` when you need to describe:

- a player-selectable or system-driven activity
- activity metadata for content authoring
- tags and governing attributes used by other systems

Use `Activity` when you need:

- a neutral message bus payload
- a lightweight event that higher-level systems can interpret

Use `ActivityTickDelta` when you need:

- one emitted tick of progress for an activity
- a quest-progress signal that can be consumed later
- a message that carries activity identity plus difficulty context

Core does not define or validate a global registry of activity IDs, tags, or governing attributes.

## Factory Helper

Core still includes the small generic event helper:

```ts
createActivity(type: string, payload?: Record<string, unknown>): Activity
```

Behavior:

- returns a plain `Activity` object
- copies the top-level payload object when provided
- freezes the returned activity and top-level payload to discourage mutation

The factory does not:

- validate activity semantics
- resolve rewards
- interpret the event

## Example Usage

```ts
import {
  createActivity,
  type Activity,
  type ActivityDefinition,
  type ActivityTickDelta
} from "@rinner/grayvale-core";

const mining: ActivityDefinition = {
  id: "mining",
  name: "Mining",
  description: "Extract ore from resource nodes over time.",
  tags: ["gathering", "resource"],
  governingAttributes: ["mining"],
  difficulty: 20,
  itemId: "copper_ore"
};

const tick: ActivityTickDelta = {
  type: "activity_tick",
  payload: {
    activityId: mining.id,
    difficulty: mining.difficulty,
    governingAttributes: mining.governingAttributes,
    tags: mining.tags,
    tickDelta: 1,
    itemId: mining.itemId
  }
};

const genericEvent: Activity = createActivity("activity_tick", {
  activityId: mining.id,
  tickDelta: 1
});
```

## Non-Goals

This module does not handle:

- activity processing
- difficulty resolution
- reward table lookup
- progression gains
- equipment lookups
- registries
- schemas

If a change starts adding those concerns, it is leaving the intended scope of the Core activity abstraction.
