# Grayvale Core Technical Documentation

## Purpose

`@rinner/grayvale-core` is a pure data package for Grayvale domain definitions.
It separates compile-time type contracts from runtime validation and lookup helpers.

The package is intentionally limited to:

- serializable data models
- Zod validation schemas
- pure deterministic transforms on in-memory data
- registry loading and lookup
- example payloads
- tests for schema and registry behavior

The package intentionally excludes:

- combat logic
- gameplay rules
- effects or events
- framework dependencies
- persistence concerns

## Architecture

The source tree is split into two layers:

- `src/core`
  Contains TypeScript contracts plus deterministic, framework-free helpers.
- `src/data`
  Contains Zod schemas, registries, example exports, and tests.

This separation keeps domain contracts stable while allowing runtime validation to evolve without polluting the type layer.

## Core Layer

Locations:

- [`src/core/models`](../src/core/models)
- [`src/core/equipment`](../src/core/equipment)

Primary model groups:

- `activity/activity.types.ts`
  Defines the generic `Activity` event contract plus authored activity and tick-delta types.
- `activity/activity.factory.ts`
  Defines a minimal factory for producing immutable top-level activity records.
- `base.ts`
  Shared `Id`, `Entity`, and `Named` contracts.
- `npc/npc.types.ts`
  Defines the data-only NPC contract for combat and non-combat characters.
- `npc/npc.helpers.ts`
  Defines pure helpers for trust thresholds, type guards, and basic NPC configuration validation.
- `equipment.ts`
  Defines `EquipmentSlot` and `EquippedItems`.
- `equipment/equip.types.ts`
  Defines the minimal item contract required by the equipment helpers.
- `equipment/equip.ts`
  Defines pure `canEquip`, `equip`, and `unequip` functions.
- `delta/delta.types.ts`
  Defines the serializable delta contract for player and NPC state updates.
- `delta/delta.state.ts`
  Defines the minimal `GameState` shape used by the delta applicator.
- `delta/delta.apply.ts`
  Defines pure immutable helpers for applying one or more deltas.
- `inventory.ts`
  Defines JSON-safe inventory storage as `Record<string, number>`.
- `modifiers/modifier.types.ts`
  Defines generic modifier and stat-block contracts.
- `modifiers/modifier.pipeline.ts`
  Defines pure helpers for collecting and computing numeric stat modifiers.
- `player.ts`
  Defines a player with attributes, skill levels, inventory, and equipment references.
- `progression.ts`
  Defines player progression state and configurable XP curve inputs.
- `skill.ts`
  Defines a tag-based skill model with future extension hooks.
- `weapon.ts`
  Defines weapon classification and allowed equipment slots.

Core rules:

- no Zod imports
- no classes with runtime behavior
- no framework dependencies
- no cross-object embedding for registries like player skills

Allowed core behavior:

- deterministic transforms that use only provided inputs
- immutable updates that return new objects
- narrow rule logic that does not depend on registries, I/O, or external frameworks

## Activity Abstraction

Location:

- [`src/core/activity`](../src/core/activity)

Exports:

- `type Activity = { type: string; payload?: Record<string, unknown> }`
- `interface ActivityDefinition`
- `type ActivityTickDelta`
- `createActivity(type, payload?)`

Design intent:

- represent authored activities as plain serializable data
- represent runtime activity events as plain serializable data
- avoid hardcoded global activity registries
- avoid coupling Core to gameplay interpretation

Current factory behavior:

- copies the top-level payload object
- freezes the returned activity object
- freezes the top-level payload object when present

This is a shallow immutability guard only.
Nested payload objects are still caller-owned unless the caller freezes them separately.

## Equipment Operations

The equipment helper module is intentionally small and function-based.

Exports:

- `canEquip(player, item, slot): boolean`
- `equip(player, item, slot): Player`
- `unequip(player, slot): Player`

Design constraints:

- no classes
- no registry lookups
- no Angular, RxJS, or other framework hooks
- no mutation of the incoming `Player`

Current supported slots:

- `mainHand`
- `offHand`

Current rule set:

- the target slot must be one of the supported slot literals
- `item.allowedSlots` must contain the target slot
- two-handed items may only be equipped to `mainHand`
- equipping a two-handed item to `mainHand` clears `offHand`
- equipping a valid item replaces the current item in that slot
- `unequip` is safe when the slot is already empty

The item contract is intentionally minimal so future equipment types can reuse the same API when they expose:

- `id`
- `handedness`
- `allowedSlots`

## Data Layer

Location: [`src/data`](../src/data)

Responsibilities:

- validate incoming JSON-compatible payloads
- load validated data into registries
- reject malformed or duplicate records
- provide canonical sample payloads
- test schema and registry behavior

Main folders:

- [`schemas`](../src/data/schemas)
- [`progression`](../src/data/progression)
- [`registry`](../src/data/registry)
- [`examples`](../src/data/examples)
- [`tests`](../src/data/tests)

## Schema Design

Schemas are strict by default for object-shaped models.
That means unknown keys are rejected instead of silently accepted.

Current schema coverage:

- `equippedItemsSchema`
- `experienceConfigSchema`
- `experienceProgressionSchema`
- `inventorySchema`
- `playerSchema`
- `skillSchema`
- `weaponSchema`

Reusable primitives live in [`shared.ts`](../src/data/schemas/shared.ts) to reduce drift across schema definitions.

## Registry Design

Current runtime registry: [`DataRegistry`](../src/data/registry/dataRegistry.ts)

Supported operations:

- `loadWeapons(data: unknown[])`
- `getWeapon(id: string)`
- `loadSkills(data: unknown[])`
- `getSkill(id: string)`

Registry guarantees:

- every loaded entry is schema-validated first
- duplicate IDs throw immediately
- lookup returns plain model data

This keeps loading deterministic and makes bad content fail fast.

## NPC Helpers

Location:

- [`src/core/npc`](../src/core/npc)

Exports:

- `getTrustThreshold(starLevel)`
- `isCombatNPC(npc)`
- `isNonCombatNPC(npc)`
- `assertValidNPC(npc)`

Current behavior:

- trust thresholds start at `100`
- each star level doubles the next threshold
- combat NPC roles must be present in `availableRoles` when both are provided
- non-combat NPCs cannot declare `availableRoles` or `equipment`

## Delta Application

Location:

- [`src/core/delta`](../src/core/delta)

Exports:

- `type Delta`
- `type GameState`
- `applyDelta(state, delta)`
- `applyDeltas(state, deltas)`

Current behavior:

- updates are immutable
- nested missing objects are created automatically
- `set` replaces values directly
- `add` only accepts numeric delta values
- `add` can initialize a missing numeric field
- NPC updates require `targetId`

The delta layer is intentionally generic and does not validate gameplay meaning for a path.

## Modifier Pipeline

Location:

- [`src/core/modifiers`](../src/core/modifiers)

Exports:

- `type Modifier`
- `type StatBlock`
- `type ModifierSourceItem`
- `getAttributeModifiers(player)`
- `getSkillModifiers(player)`
- `getEquipmentModifiers(items)`
- `collectModifiers(player, items)`
- `computeFinalStats(baseStats, modifiers)`

Current formula:

```ts
finalStat = (baseStat + additiveTotal) * multiplicativeTotal
```

Design intent:

- keep stats generic and string-keyed
- keep the pipeline deterministic and framework-free
- allow equipment to contribute copied modifier records
- avoid coupling stat computation to combat or progression systems

## Skill Model Notes

The `Skill` model is intentionally lightweight:

- `id`
- `name`
- `description?`
- `tags`
- `experience?`
- `maxLevel?`

Important design choice:

- players do not embed `Skill` objects
- players store only `Record<string, number>` skill levels

That choice avoids duplicated metadata and keeps save payloads compact.

## Experience Progression

Player level state now lives under `player.progression`:

- `level`
- `experience`

The runtime-configurable XP formula for the next level is:

```ts
xpRequired = baseXp * (level ** exponent) * growthFactor
```

Configuration fields:

- `baseXp`
  The baseline XP magnitude.
- `growthFactor`
  A general multiplier for the entire curve.
- `exponent`
  The main scaling intensity as level rises.

Validation rules:

- all fields must be numbers
- all fields must be greater than `0`
- config objects are strict

The calculation helper is implemented as a pure function in [`experience.ts`](../src/data/progression/experience.ts).
JSON loading is handled through schema-backed helpers in [`loaders.ts`](../src/data/progression/loaders.ts).

## Skill Progression Hooks

Skill progression is intentionally not fully implemented yet.

Current invariant:

- each skill level requires `100` XP
- skill XP gain may be decimal

The constant lives in [`constants.ts`](../src/data/progression/constants.ts).
No skill leveling side effects or rule execution are present in this package.

## Build And Test

Useful commands:

```bash
npm run check
npm test
npm run build
```

Expected workflow:

1. edit core types if the data contract changes
2. update pure core helpers if rule behavior changes
3. update or add schemas in the data layer
4. add or update tests
5. run typecheck, tests, and build

## Extension Guidance

Safe future additions:

- more registries
- more schemas for additional data domains
- cross-registry validation utilities
- content import tooling

Avoid introducing the following into this package unless the project direction changes:

- rule systems
- simulation logic
- side-effecting loaders
- framework-specific adapters
