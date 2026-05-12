# Definition Migration Work Log

## Epic 1 — Definition source migration to server

### Completed

- Inventoried `game/src/assets/data` and classified the editable definition sources.
- Migrated editable definitions into `server/data/definitions/{items,materials,locations,activities,actions}`.
- Preserved the existing per-definition JSON shapes while splitting array-based files into server-owned per-ID files.
- Kept location default-state metadata in `server/data/definitions/locations/_defaults.json`.

### Migration map

```ts
{
  items: [
    "game/src/assets/data/inventory-items.json (category !== 'material') -> server/data/definitions/items/*.json"
  ],
  materials: [
    "game/src/assets/data/inventory-items.json (category === 'material') -> server/data/definitions/materials/*.json"
  ],
  locations: [
    "game/src/assets/data/world-locations.json -> server/data/definitions/locations/*.json",
    "game/src/assets/data/world-locations.json defaultState -> server/data/definitions/locations/_defaults.json"
  ],
  activities: [
    "game/src/assets/data/activities.json -> server/data/definitions/activities/*.json"
  ],
  actions: [
    "game/src/assets/data/actions.json -> server/data/definitions/actions/*.json"
  ],
  other: [
    "character-names.json",
    "character-creator.json",
    "attributes.json",
    "dialogue-actors.json",
    "dialogue-project.json",
    "dialogues.json",
    "quests.json",
    "skills.json",
    "world-graph.json",
    "world-guards.json",
    "balance-profiles.json",
    "progression/difficulty-curves.json",
    "chat-emotes.json",
    "base-stats.json"
  ]
}
```

### Shape notes

- `items` and `materials` use `id`, `name`, `category`, `rarity`, `tags`, optional `description`, and optional `iconPath`; equipment items also include `slot`, `itemLevel`, `requirements`, `damage`, `combatStats`, and `tooltip`.
- `locations` use `id`, `label`, `subtitle`, `sceneImagePath`, `availableNpcIds`, and optional nested `sublocations`, `entryGuards`, and `exitGuards`.
- `activities` use `id`, `name`, `description`, `location`, `tags`, `governingAttributes`, `difficulty`, and `rewards`; some also include `questSignal`.
- `actions` use `id`, `name`, `description`, `tags`, `cost`, `effect`, and optional `requirements`.

### ID and reference findings

- Migrated editable definition files all have explicit top-level `id` fields.
- `world-locations.json` contains nested sublocation IDs, but `defaultState` has no standalone `id`.
- Non-migrated files with inconsistent or missing IDs include `character-names.json`, `dialogue-project.json`, `base-stats.json`, `progression/difficulty-curves.json`, and `world-guards.json`.
- Definition-to-definition references currently include:
  - activity rewards targeting item IDs such as `mat_medicine_herb_t1`
  - activity locations referencing `location.locationId` and `location.sublocationId`
  - location NPC references via `availableNpcIds`
  - location guard references via quest and attribute IDs
  - action requirements referencing location IDs

### Image references

- Item and material icons: `assets/images/resources/items/equipment/*`, `assets/images/resources/materials/*`
- Location backgrounds: `assets/images/location-backgrounds/*`

## Epic 2 — SQLite definition cache/index

### Completed

- Added a dedicated `definitions` SQLite table keyed by `(type, id)` with `version`, `hash`, `json`, `source_path`, and `updated_at`.
- Added startup sync from `server/data/definitions` into SQLite.
- Added per-type disk validation for items, materials, locations, activities, and actions.

### Notes

- JSON files remain the editable source of truth; SQLite is rebuilt from the files during server startup.
- Duplicate IDs and file-name/id mismatches now fail startup clearly.
- The sync path skips underscore-prefixed metadata files such as `locations/_defaults.json`.

## Epic 3 — Server definition APIs

### Completed

- Added public list/info/batch/get-by-id endpoints for items, materials, locations, activities, and actions.
- Added legacy full-definition endpoints backed by the new server-owned definitions for the current game client.
- Rewired the current activity, action, and inventory readers to server-owned definition endpoints.

### Public endpoints

- `GET /api/items`
- `GET /api/materials`
- `GET /api/locations`
- `GET /api/activities`
- `GET /api/actions`
- `GET /api/definitions/:type/:id`
- `POST /api/definitions/:type/info`
- `POST /api/definitions/:type/batch`

### Legacy compatibility endpoints

- `GET /api/inventory-items`
- `GET /api/equipment-items`
- `GET /api/activity-definitions`
- `GET /api/action-definitions`
- `GET /api/world-locations`
- `GET /api/world-default-state/default`
