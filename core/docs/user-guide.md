# Grayvale Core User Guide

## What This Package Is

This package defines the foundational Grayvale data shapes used by other systems.
If you need to describe a player, NPC, skill, weapon, inventory, or equipment state in JSON, this package is the source of truth.

## What You Can Do With It

You can use this package to:

- define player save data
- define NPC data
- validate content files before use
- register weapons and skills by ID
- apply deterministic equipment changes to player data
- apply immutable state deltas to players and NPCs
- collect and compute stat modifiers from players and equipment
- share a stable contract between tools and game systems

You should not use this package for:

- combat calculations
- skill progression logic
- crafting systems
- UI behavior

## Mental Model

Think of the package in two parts:

- `core`
  The shape of the data.
- `data`
  The tools that verify the data is valid.

If you are only writing TypeScript against the models, you mostly care about `core`.
If you are loading JSON or external content, you will also care about `data`.

`core` also includes a small pure equipment helper module for updating hand-slot state on a `Player`.
It also includes activity contracts for authored activities and runtime activity events.
It also includes NPC helpers, a path-based delta applicator, and a generic modifier pipeline.

## Player Data

A player stores:

- identity and basic progression
- attribute values
- skill levels by skill ID
- inventory item counts
- equipped item IDs

Important detail:

- `skills` stores only IDs and levels
- skill names, descriptions, and tags live in the skill registry
- `equippedItems` stores only item IDs by slot

Example:

```ts
skills: {
  short_blade: 2,
  bow: 1,
  blacksmithing: 3
}
```

## Skill Data

A skill represents reusable metadata about a learnable domain.

Each skill has:

- `id`
- `name`
- optional `description`
- at least one tag

Tags are plain strings and are not constrained to enums yet.

## Player Progression

Players no longer store top-level `level` directly.
Instead, player progression is grouped like this:

```ts
progression: {
  level: number;
  experience: number;
}
```

This keeps level state and accumulated XP together in one place.

## Equipment API

Use the Core equipment helpers when you want to update `player.equippedItems` without mutating the original player object.

Available functions:

- `canEquip(player, item, slot)`
- `equip(player, item, slot)`
- `unequip(player, slot)`

The helpers live in [`src/core/equipment`](../src/core/equipment) and are exported from the package core entrypoint.

Required item shape:

```ts
{
  id: string;
  handedness: "oneHanded" | "twoHanded";
  allowedSlots: ("mainHand" | "offHand")[];
}
```

Example:

```ts
import { equip, unequip, type Player, type Weapon } from "@rinner/grayvale-core";

const updated = equip(player, weapon, "mainHand");
const cleared = unequip(updated, "offHand");
```

Current behavior:

- `canEquip` returns only `true` or `false`
- `equip` throws a descriptive error when the request is invalid
- `unequip` never throws if the target slot is already empty
- equipping a two-handed item to `mainHand` clears `offHand`
- equipping a two-handed item to `offHand` is rejected
- the helpers never mutate the original `Player`

## Activity Data

Core exposes three related activity contracts:

- `ActivityDefinition`
  Authored metadata for an activity such as mining or foraging.
- `Activity`
  A generic JSON-safe event envelope for the message bus.
- `ActivityTickDelta`
  A typed per-tick event for quest progress and other downstream listeners.

`ActivityDefinition` includes:

- `id`
- `name`
- optional `description`
- `tags`
- `governingAttributes`
- `difficulty`
- optional `itemId`

Available helper:

- `createActivity(type, payload?)`

Important constraints:

- activity IDs, tags, and governing attributes remain plain strings
- difficulty is an arbitrary numeric value on the activity itself
- `itemId` is only an attached reference, not interpreted behavior
- Core does not interpret or validate gameplay meaning

Example:

```ts
import { createActivity, type ActivityDefinition } from "@rinner/grayvale-core";

const mining: ActivityDefinition = {
  id: "mining",
  name: "Mining",
  tags: ["gathering", "resource"],
  governingAttributes: ["mining"],
  difficulty: 20,
  itemId: "copper_ore"
};

const tick = createActivity("activity_tick", {
  activityId: mining.id,
  difficulty: mining.difficulty,
  tickDelta: 1
});
```

Reference docs:

- [`docs/activity.md`](./activity.md)

## NPC Data

Core exposes a single `NPC` model that supports both combat and non-combat characters.

Important constraints:

- `type` is either `combat` or `noncombat`
- combat NPCs may use `role`, `availableRoles`, and `equipment`
- non-combat NPCs may use `bonus`
- trust and star progression remain stored as plain numeric values

Available helpers:

- `getTrustThreshold(starLevel)`
- `isCombatNPC(npc)`
- `isNonCombatNPC(npc)`
- `assertValidNPC(npc)`

Example JSON:

- [`npc.json`](../examples/npc.json)

Reference docs:

- [`docs/npc.md`](./npc.md)

## Delta Updates

Core exposes an immutable delta system for updating a `GameState` without mutating the original objects.

Available helpers:

- `applyDelta(state, delta)`
- `applyDeltas(state, deltas)`

Current rules:

- deltas target either `player` or `npc`
- NPC deltas require `targetId`
- `set` replaces a value
- `add` increments numeric values only
- missing nested objects are created as needed

Example JSON:

- [`delta.json`](../examples/delta.json)

Reference docs:

- [`docs/delta.md`](./delta.md)

## Modifier Pipeline

Core also exposes a small generic modifier pipeline for computing numeric stat blocks.

Available helpers:

- `getAttributeModifiers(player)`
- `getSkillModifiers(player)`
- `getEquipmentModifiers(items)`
- `collectModifiers(player, items)`
- `computeFinalStats(baseStats, modifiers)`

Current calculation order:

```ts
(base + totalAdditive) * totalMultiplicative
```

Example JSON:

- [`modifiers.json`](../examples/modifiers.json)

Reference docs:

- [`docs/modifiers.md`](./modifiers.md)

## Difficulty And XP Scaling

XP progression is configurable through JSON files rather than hardcoded.
That means different playthroughs can use different progression curves such as easy, normal, or hard.

Current example configs:

- [`easy.json`](../examples/easy.json)
- [`normal.json`](../examples/normal.json)
- [`hard.json`](../examples/hard.json)

The formula for XP needed for the next level is:

```ts
baseXp * (level ** exponent) * growthFactor
```

What the fields mean in practice:

- lower `growthFactor` makes all levels cheaper
- lower `exponent` makes higher levels ramp more gently
- higher `exponent` makes later levels climb faster

So, for example:

- easy progression grows more slowly
- normal progression is more moderate
- hard progression ramps up more aggressively at higher levels

## Skill XP Note

Skills do not use the global player XP curve.
Each skill is expected to require `100` XP per level, and skill XP may be fractional.

That rule is only a config hook right now.
This package does not implement skill gain or level-up behavior yet.

## Validation

Use the data layer schemas when content comes from JSON, tools, or external files.

Examples:

- validate a player with `playerSchema`
- validate a skill with `skillSchema`
- validate a weapon before loading it into a registry

This helps catch:

- missing required fields
- wrong value types
- malformed nested structures
- unknown keys

## Registries

`DataRegistry` is the current loader and lookup helper.

Use it when you want to:

- load multiple skills
- load multiple weapons
- retrieve them by ID later

The registry rejects duplicate IDs so content issues surface early.

## Example Content

There are two forms of example data:

- typed example exports in [`src/data/examples`](../src/data/examples)
- plain JSON files in [`examples`](../examples)

Activity example:

- [`activity.json`](../examples/activity.json)

Additional core examples:

- [`npc.json`](../examples/npc.json)
- [`delta.json`](../examples/delta.json)
- [`modifiers.json`](../examples/modifiers.json)

Use the JSON files as templates when authoring content outside TypeScript.

## Recommended Workflow

1. Define or edit JSON content.
2. Validate it with the matching schema.
3. Load it into a registry if you need indexed lookups.
4. Store only IDs for references between objects.

## Common Mistakes To Avoid

- putting full skill objects inside a player
- inventing nested skill trees inside player data
- adding unknown keys and assuming they will be ignored
- expecting Core equipment helpers to query a registry for you
- mutating `player.equippedItems` directly when you want deterministic updates
- mixing gameplay logic into this package
