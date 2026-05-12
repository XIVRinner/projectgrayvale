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

## Epic 7 — Centralized tag registry

### Current tag handling findings

- Core schemas still model tags as `string[]`.
- Server-side extracted entities also store tags as plain strings in `api_entity_tags`.
- Current item, material, action, activity, and skill data all use string tag arrays; no object-backed tag model exists yet.

### Completed

- Added a server-owned `server/data/definitions/tag-registry.json`.
- Added `GET /api/tags` to expose categories, labels, descriptions, and allowed usage metadata.
- Kept runtime compatibility with existing string tags in all definitions.

## Epic 8 — Admin authentication investigation

### Current auth findings

- Login is handled through the multiplayer join flow (`POST /api/server/join`), which creates a server session and sets the `grayvale_session` cookie.
- Runtime auth is cookie/session based, not JWT based; `grayvale_session` is an HTTP-only cookie and `/api/auth/me` also accepts the session ID via body/query for compatibility.
- Admin elevation uses the configured server `adminPassword` via `POST /api/server/admin/grant`; the password is timing-safe compared server-side and is never returned to the client.
- Admin rights are represented by `player.rank === "admin"`.
- Current-user/admin state is available through `GET /api/auth/me`.

### Completed

- Confirmed `GET /api/auth/me` returns `authenticated`, `admin`, and `username`.
- Confirmed anonymous, invalid-session, missing-player, and banned-player requests all resolve to a safe anonymous response.

## Epic 9 — Kairos Edit shell

### Completed

- Added client-side admin auth status polling through `GET /api/auth/me`.
- Added a footer-only `Kairos Edit` entry that remains hidden until admin status has been confirmed and is true.
- Added a near-fullscreen PrimeNG Kairos Edit modal shell with tabs for Items, Materials, Locations, Activities, Actions, and `Tags — WIP`.

### Notes

- The footer button is shown next to the server status block and only for authenticated admins.
- The new modal is shell-only in this PR; definition editor infrastructure and write APIs remain for later tasks.
- The Tags tab is intentionally present but marked WIP / out of scope.

## Epic 4 — Server-side images/assets

### Completed

- Moved migrated definition image ownership into `server/public/assets/definitions/{items,materials,locations,activities,actions}`.
- Updated migrated item/material/location definitions to use server-owned `imageId` / `sceneImageId` fields instead of bundled client asset paths.
- Added server asset endpoints and metadata endpoints for definition images.

### Public endpoints

- `GET /api/assets/:type/:assetId`
- `GET /api/assets/:type/:assetId/info`

### Notes

- Asset endpoints resolve files by asset ID, compute hash metadata from the file contents, and return content-type-specific responses.
- Missing assets return a clean JSON `404`.
- Legacy definition payloads still expose `iconPath` / `sceneImagePath` compatibility fields backed by the new server asset routes.

## Epic 5 — Game client definition cache

### Completed

- Added `DefinitionRepositoryService` for ID-based item/material/location/activity/action reads.
- Added IndexedDB-backed cached definition records keyed by `(type, id)` using the shared Grayvale cache database.
- Added metadata-driven stale detection and batch definition refresh flow for item IDs.

### Notes

- The client now supports `listItemIds()`, `getItem()`, `getItems()`, `getMaterial()`, `getLocation()`, `getActivity()`, and `getAction()`.
- Cached definitions store `hash`, `version`, `updatedAt`, `cachedAt`, and the full definition payload.
- Character sheet consumers now request only the definitions they need instead of loading the full legacy item payloads.

## Epic 6 — Game client image cache

### Completed

- Added `DefinitionImageService` with IndexedDB-backed blob caching for server-served definition images.
- Added transparent image resolution by asset ID for item/material/location definition images.
- Rewired current character sheet and world-location consumers to resolve cached object URLs instead of bundled static image paths.

### Notes

- Cached image records store `assetType`, `assetId`, `hash`, `contentType`, `blob`, and `cachedAt`.
- Image URLs now fall back cleanly to the existing placeholder texture when an asset is missing.
