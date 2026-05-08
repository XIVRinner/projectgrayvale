# Grayvale Character Sheet MVP

This document describes the Character Sheet MVP **as it is currently implemented** in the Angular 21 game client.

## Scope and Target

- Target framework: **Angular 21**
- Current top-level UI: a tabbed character sheet with **Equipment**, **Stats**, and **Inventory** tabs
- Current data sources: the active roster player plus static item/settings JSON in `game/src/assets/data/`
- Current state ownership: `CharacterRosterService` for player/loadout state, local signals only for view-local UI state such as active tab and compare selection

The current MVP is intentionally focused on loadouts, equipment, combat-stat math, inventory browsing, and item tooltips. It does **not** ship the broader long-term character-sheet vision yet.

## Character Identity Fields

The shared model shape for character identity lives in `@rinner/grayvale-core` and currently supports these fields:

- `id`
- `name`
- `raceId`
- `genderId?` — display-only for MVP
- `level`
- `classId?`
- `adventurerRank?`
- `tags: string[]`
- `activeLoadoutId`
- `inventory`

Implementation notes:

- `adventurerRank` is optional because rank is unlocked later.
- `classId` is optional.
- `tags` are required even when empty.
- Race-derived tags are expected to merge in at runtime later.

**Current UI status:** the shipped Character Sheet tab set does **not** render a dedicated identity header yet. The identity fields are documented here because the data model already supports them.

## Equipment Slots

The implemented MVP loadout/equipment flow uses these eight slots:

- `head`
- `main_hand`
- `chest`
- `off_hand`
- `gloves`
- `ring`
- `legs`
- `boots`

UI rules that match the current panel:

- every slot renders in a fixed order
- empty slots show an explicit empty state
- equipped slots show item name, rarity label, and item level
- compared slots get a dedicated compare highlight
- special-rarity equipment shows a badge
- hovering an equipped slot opens the shared item tooltip shell

## Loadout Behavior

The current MVP reads loadouts from the active roster player and writes equipment changes back through the roster service.

Implemented behavior:

- sample data starts with two loadouts: **Default** and **Dodge Build**
- exactly one loadout is active at a time
- selecting a loadout updates the active equipment, stats, and inventory comparisons together
- creating a loadout adds a new empty loadout with an auto-generated name
- renaming a loadout updates only its display name
- equipping from the loadout selector writes the item ID into the active loadout slot map
- unequipping deletes that slot entry from the active loadout
- comparison is slot-based and currently uses **item level delta text**, not full stat simulation

Not implemented in the current MVP:

- persistence
- resolver profiles
- rotation profiles
- activity restrictions
- galvanized validation
- boss-specific warnings

## Inventory Categories

The current inventory panel supports these categories:

- `all`
- `equipment`
- `material`
- `quest_item`
- `junk`

Category behavior:

- the header row shows tab counts per category
- category filtering is client-side
- the search box filters against normalized item name, rarity, category, and tag terms

Per-category display rules:

- **equipment**: item level plus compare summary
- **material**: quantity plus quality stars when present
- **quest items**: quest-item label
- **junk**: junk label

## Inventory Actions

The current MVP exposes these user actions in the inventory panel:

- filter by category
- search inventory
- inspect tooltip on hover
- compare an equipment item against the active slot item
- equip an equipment item into the active loadout
- unequip an equipped item from the active loadout

Important limits:

- materials, quest items, and junk are inspect-only in the current UI
- there is **no** drag-and-drop flow
- there is **no** favorite/lock action
- there is **no** inventory move/sort/persistence system

## Stat Math Rules

The Stats tab is currently combat-stat-only.

Current data flow:

1. read the active player's base attributes from the roster
2. derive `max_hp` from active health state / health balance profile
3. load equipment definitions from `assets/data/equipment-items.json`
4. gather active loadout item modifiers
5. build `LabeledModifier[]`
6. compute `StatBreakdown` records through `computeStatBreakdowns`

Current math rules:

- additive modifiers are summed per stat
- multiplicative modifiers are multiplied per stat
- final stat formula is:

```text
(base + sum(add modifiers)) * product(multiply modifiers)
```

- inactive modifiers stay visible in breakdowns but do **not** change the final total
- the current Stats tab renders these configured keys:
  - `strength`
  - `mentality`
  - `physical_damage`
  - `dodge_chance`
  - `block_chance`
  - `armor`
  - `fire_resistance`
  - `max_hp`
  - `mana`

### Future Non-Combat Stats

The underlying model shape already supports future stat expansion:

- `StatBlock` is `Record<string, number>`
- modifiers target arbitrary string stat keys
- breakdowns are keyed by stat string, not by a fixed enum

That means future non-combat stats are supported by the model shape, but they are **not implemented in the current Character Sheet UI** because the Angular view only renders the combat-focused stat config above.

## Green / Red Number Display

Current display-state rules come directly from the computed `StatBreakdown.displayState`:

- `buffed` → final value is above base
- `nerfed` → final value is below base
- `neutral` → final value equals base and no inactive-only cue applies
- `muted` → final value is neutral but the stat has inactive modifiers in its breakdown
- `special` → final value is above base and at least one active modifier is marked special

Current UI treatment:

- green numbers for `buffed`
- red numbers for `nerfed`
- muted/low-emphasis text for `muted`
- accent treatment for `special`
- delta text follows the same state coloring rules

Example from current sample data:

- `Ring of Split Mind` makes **Strength** green with `+20`
- the same ring makes **Mentality** red with `-20`

## Tooltip Families

The shared tooltip shell chooses a family by inventory item category:

- `equipment` → equipment tooltip body
- `material` → material tooltip body
- `quest_item` → quest tooltip body
- `junk` → junk tooltip body

### Equipment Tooltip

Currently rendered sections:

- header
- base rarity label
- optional special-rarity badges
- optional legendary-family focus block
- slot + item level
- requirements
- combat stats
- special effects (raw effect IDs for now)
- tags
- description / flavor

Documented but intentionally blocked by GAP notes in code:

- skill association
- rotation impact
- power window
- training impact
- effect display-name registry

### Material Tooltip

Currently rendered sections:

- quantity
- quality stars when present
- crafting use tags
- source
- tags
- description / flavor

### Quest Tooltip

Currently rendered sections:

- quest / use context
- status (`Usable`, `Not usable`, or `Locked`)
- designation badge when present
- description / flavor

### Junk Tooltip

Currently rendered sections:

- sell value when present
- description / flavor

## Rarity Visual Treatment

The current MVP uses one tooltip shell with rarity-driven token overrides instead of separate tooltip components per rarity.

### Base rarity treatment

Supported base-rarity states in the tooltip shell:

- `junk`
- `common`
- `uncommon`
- `rare`
- `epic`
- `legendary`
- `ephemeral`
- `mythical`
- `primal`

Current behavior:

- all base rarities tint the shell border/background from shared rarity tokens
- `legendary`, `ephemeral`, `mythical`, and `primal` add a dedicated focus block in the tooltip header area
- `legendary`, `ephemeral`, `mythical`, and `primal` also add stronger box-shadow treatment than lower tiers

### Special rarity treatment

The tooltip shell also supports these special-rarity overlays and badges:

- `cursed`
- `divine`
- `infernal`
- `phantom`
- `temporal`
- `secret`
- `galvanized`

Current behavior:

- special rarities render uppercase badges in the header
- special rarities can render one or more focus sections with explanatory copy
- critical special states add stronger shell emphasis
- equipment slots and inventory rows also surface special rarity with compact badges

## MVP Non-Goals

The following are out of scope for the currently implemented MVP:

- full combat simulation
- raid or dungeon resolver behavior
- crafting UI
- vendor UI
- drag-and-drop polish
- final rarity animation work
- persistence / save integration
- multiplayer behavior
- complete equipment balance
- complete stat taxonomy
- non-combat stat panels in the Character Sheet UI
- a shipped character identity header in the Character Sheet tab set

## Current Page Shape

The shipped Angular 21 Character Sheet is currently organized as:

- **Equipment tab**: loadout selector + equipment panel
- **Stats tab**: combat stat groups + breakdown drawer
- **Inventory tab**: category tabs + search + inventory item list

This document should be updated whenever the implemented tab layout, supported model fields, or tooltip/stat rules change.
