# Activity Nodes

[Classes](./classes.md) | [Companions](./companions.md)

## Activity Model

**Rule:**  
An activity is an authored definition that the tick system advances over time.

Each activity must define:

- `id`
- `name`
- `description`
- `tags`
- `governingAttributes`
- `difficulty`
- optional attached `itemId`

`difficulty` is an arbitrary number.
Higher-level systems use that value to determine gains, item outcomes, and other scaling tied to the activity.

## Tick Flow

1. The player starts or is assigned an activity.
2. The tick system advances that activity.
3. Each tick emits an `activity_tick` delta onto the central message bus.
4. Other systems such as quests can consume those deltas later and track progress by activity, tags, attributes, difficulty, or attached item.

## Tick Delta Shape

Each emitted tick delta should include:

- `activityId`
- `difficulty`
- `governingAttributes`
- `tags`
- `tickDelta`
- optional `itemId`

This delta is a progress signal.
It does not resolve rewards by itself.

## Authoring Rules

When defining a new activity:

- Give it a stable `id`.
- Use a clear player-facing `name`.
- Keep `description` short and functional.
- Use tags for cross-system filtering rather than hardcoded branches.
- Put all governing attributes on the activity definition.
- Set `difficulty` as a plain number.
- Only attach `itemId` when the activity has a specific item relationship worth exposing to other systems.

## Example Activity: Mining

- `id`: `mining`
- `name`: `Mining`
- `description`: Extract ore from resource nodes over time.
- `tags`: `gathering`, `resource`
- `governingAttributes`: `mining`
- `difficulty`: `20`
- `itemId`: `copper_ore`

## Notes

- Combat does not need special treatment in this document.
- If combat ends up using a different runtime model later, it can do so without breaking the generic activity definition or tick-delta bus flow.
