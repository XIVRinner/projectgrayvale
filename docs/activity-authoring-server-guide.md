# Server-Based Activity Authoring Guide

This guide is the fastest way to add new gameplay activities and get them live through the server APIs.

## Goal

Use JSON files in `game/src/assets/data`, let the server ingest them, and have the gameplay execution graph (GEG) expose the new actions in game.

## How the pipeline works

1. You edit JSON in `game/src/assets/data`.
2. Server auto-refresh detects `.json` changes and reseeds:
   - `json_resources` table
   - `api_entities` table
3. Game loaders read from server endpoints first (`/api/...`) and fall back to static data when needed.
4. GEG recompiles from world + guard + activity data and shows the new activity actions.

## Files to edit

- Activities: `game/src/assets/data/activities.json`
- World contexts: `game/src/assets/data/world-locations.json`
- Guards used by visibility/enabled checks: `game/src/assets/data/world-guards.json`

## Context rules (critical)

An activity context must resolve to one of these:

- Top-level location context: `locationId: "forest_edge"` -> `forest_edge:default`
- Sublocation context: `locationId: "village-arkama", sublocationId: "tavern"` -> `village-arkama:tavern`

Recommended: always use explicit `locationId + sublocationId` for sublocation activities.

Shorthand support: if you set `locationId` to a sublocation id (for example `"tavern"`) and omit `sublocationId`, GEG now maps it to the owning location when that sublocation id is unique.

## Activity templates (all supported patterns)

### 1) Basic progression activity (attribute reward)

```json
{
  "id": "village_lifting",
  "name": "Lift Supply Crates",
  "description": "Move heavy crates for the quartermaster.",
  "location": { "locationId": "village-arkama" },
  "tags": ["labour", "repeatable"],
  "governingAttributes": ["strength"],
  "difficulty": 5,
  "rewards": [
    {
      "type": "attribute",
      "targetId": "strength",
      "value": { "type": "flat", "amount": 0.2 },
      "distribution": { "type": "deterministic" }
    }
  ]
}
```

### 2) Gathering activity (item reward)

```json
{
  "id": "gather_mushroom_t1",
  "name": "Gather Cave Mushrooms",
  "description": "Collect edible mushrooms from shaded ground.",
  "location": { "locationId": "forest_edge" },
  "tags": ["gathering", "resource", "t1"],
  "governingAttributes": ["agility"],
  "difficulty": 4,
  "rewards": [
    {
      "type": "item",
      "targetId": "mat_mushroom_t1",
      "value": { "type": "range", "min": 1, "max": 2 },
      "distribution": { "type": "deterministic" }
    }
  ]
}
```

### 3) Combat-style activity (quest signal)

```json
{
  "id": "wolf_hunt_t1",
  "name": "Hunt Wolves",
  "description": "Track and cull wolves threatening trade routes.",
  "location": { "locationId": "forest_edge" },
  "questSignal": { "type": "kill", "target": "wolf", "count": 1 },
  "tags": ["combat", "quest", "repeatable"],
  "governingAttributes": ["agility", "vitality"],
  "difficulty": 8,
  "rewards": [
    {
      "type": "item",
      "targetId": "mat_wolf_hide_t1",
      "value": { "type": "flat", "amount": 1 },
      "distribution": { "type": "random", "chance": 0.5 }
    }
  ]
}
```

### 4) Service/job activity (currency + skill)

```json
{
  "id": "inn_service",
  "name": "Serve at the Inn",
  "description": "Take orders, clean tables, and earn wages.",
  "location": {
    "locationId": "village-arkama",
    "sublocationId": "tavern"
  },
  "tags": ["service", "labour", "indoor"],
  "governingAttributes": ["tavern_work"],
  "difficulty": 5,
  "rewards": [
    {
      "type": "currency",
      "value": { "type": "range", "min": 1, "max": 3 },
      "distribution": { "type": "random_interval", "tickMin": 5, "tickMax": 10 }
    },
    {
      "type": "skill",
      "targetId": "tavern_work",
      "value": { "type": "flat", "amount": 0.02 },
      "distribution": { "type": "deterministic" }
    }
  ]
}
```

### 5) Healing activity (scaled reward)

```json
{
  "id": "field_medicine",
  "name": "Field Medicine",
  "description": "Treat wounds using gathered supplies.",
  "location": { "locationId": "camp" },
  "tags": ["healing", "camp"],
  "governingAttributes": ["medicine"],
  "difficulty": 2,
  "rewards": [
    {
      "type": "attribute",
      "targetId": "hp",
      "value": {
        "type": "scaled",
        "base": 2,
        "scaling": { "source": "skill", "id": "medicine", "factor": 2 }
      },
      "distribution": { "type": "deterministic" },
      "maxHealPercent": 80
    }
  ]
}
```

## Reward support matrix

- Reward `type`: `item`, `currency`, `attribute`, `skill`
- Reward `value.type`: `flat`, `range`, `scaled`
- Reward `distribution.type`: `deterministic`, `random`, `random_interval`

## Fast add workflow

1. Add/edit entries in `activities.json`.
2. Ensure each activity context exists in `world-locations.json`.
3. Save files; server auto-refresh reseeds data.
4. Open health endpoint and verify seed counts:
   - `GET /api/health`
5. Verify entities:
   - `GET /api/activities`
   - `GET /api/activities/<activity-id>`
6. In game, verify no GEG warnings and action appears in the expected location context.

## Debugging checklist

- `GEG_W003 unknown context`: context mismatch between activity location and world locations.
- Activity missing in API: invalid JSON shape rejected during parse.
- Activity in API but not visible: guard conditions in world/action evaluation hide or disable it.
- Duplicated sublocation ids across locations: shorthand mapping becomes ambiguous; use explicit `locationId + sublocationId`.

## Important note about `actions.json`

`actions.json` is currently used by the legacy action store flow, not by GEG compilation.

If you need a new entry to appear in GEG action groups, add it as an activity in `activities.json` (or plan a dedicated GEG-authored-actions integration).

## ValeFlow dialogue checklist (for unlock scripts)

Use this before committing any `.fsc` file.

- Use `chapter <NAME>:` blocks, not markdown headings or `@scene`.
- Use `narrator "..."` or `<actorVar> "..."` for lines.
- Define local actors with `declare x = Actor("id")` if needed.
- Use `choice:` with valid branches:
  - shorthand: `"Label" -> TARGET_CHAPTER`
  - body form: `-> "Label":` followed by indented statements
- Call host hooks with `call unlockActivity("activity_id")`.
- Keep indentation consistent (spaces, no tabs).
- Ensure the dialogue is registered in:
  - `game/src/assets/data/dialogues.json`
  - `game/src/assets/data/dialogue-project.json`
- Ensure GEG action points to the same `dialogueTarget` id.

### Minimal valid unlock script skeleton

```fsc
declare npc = Actor("some-actor-id")

chapter START:
    narrator "Scene setup line."
    npc "Prompt line."
    choice:
        -> "Accept":
            call unlockActivity("some_activity_id")
            narrator "You've unlocked: Some Activity."
        -> "Not now":
            npc "Come back when you are ready."
```
