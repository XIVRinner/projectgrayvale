# Grayvale Character Sheet MVP

## Purpose

The Character Sheet MVP is a separate project from the Combat MVP.

It is the player-facing hub for:

- character identity
- combat-relevant math
- equipment
- loadouts
- inventory
- item actions
- item tooltips
- rarity presentation

The page should be implemented in Angular 21.

The implementation should stay MVP-focused and data-driven.

## Goals

- Show character identity.
- Show equipment slots.
- Support loadouts.
- Show inventory split by category.
- Support inventory/equipment actions.
- Show combat math with buffed/nerfed values.
- Show stat breakdowns.
- Show equipment, material, quest item, and junk tooltips.
- Show rarity-specific visual treatment.
- Support future non-combat stats without implementing them yet.

## Non-Goals

Do not implement these in the MVP:

- full combat simulation
- raid resolver
- dungeon inventory logic
- crafting UI
- vendor UI
- drag-and-drop polish
- final animation implementation
- full persistence
- multiplayer
- complete equipment balance
- complete stat taxonomy

## Character Identity

The character sheet should display:

- name
- race
- gender
- level
- class/archetype if available
- adventurer rank when unlocked
- character tags when relevant

Race may eventually produce tags.

Example:

```text
Race: Elf
Tags: elf, humanoid
```

Gender is display-only for MVP unless future systems use it.

Adventurer rank is optional/unlocked.

## Combat Math

The sheet should show final calculated combat stats.

Examples:

```text
Strength: 40 (+20)
Mentality: 10 (-20)
Dodge: 18% (+12%)
Slashing Armor: 4
Piercing Armor: 2
Fire Resistance: -10
```

Color rules:

- green = buffed/improved
- red = nerfed/reduced
- neutral = unchanged
- muted = inactive/expired/locked
- gold/special = legendary or special source

Every final number should be explainable through a breakdown.

Example:

```text
Strength 40
Base: 20
Brutal Ring: +20
Final: 40
```

Example:

```text
Mentality 10
Base: 30
Cursed Ring: -20
Final: 10
```

## Equipment

MVP equipment slots:

- head
- chest
- gloves
- legs
- boots
- main_hand
- off_hand
- ring

The equipment panel should show:

- equipped item
- empty slot state
- rarity frame
- item level
- special rarity badges
- power-window state if any
- tooltip trigger
- comparison when relevant

## Loadouts

MVP loadout model:

- loadout id
- display name
- equipment slot map
- active flag
- optional notes

MVP actions:

- create loadout
- rename loadout
- select active loadout
- equip item to active loadout
- unequip item from active loadout
- compare item against active loadout slot

Future:

- resolver profile attached to loadout
- rotation profile attached to loadout
- activity restrictions
- galvanized validation
- boss-specific warnings

## Inventory

Inventory categories:

- equipment
- materials
- quest items
- junk

Inventory should support actions.

MVP actions:

- equip
- unequip
- compare
- move item to loadout
- inspect tooltip
- mark favorite if easy
- filter by category
- search if easy

Materials should show:

- quantity
- rarity
- quality stars when applicable
- crafting tags
- source if known

Quest items should show:

- quest/use context
- description
- special rarity if any

Junk should show:

- sell value if known
- description
- flavor

## Tooltip Families

Tooltips share a visual family but differ by item type.

Families:

- equipment tooltip
- material tooltip
- quest item tooltip
- junk tooltip

Equipment tooltip is richest.

Equipment tooltip sections:

- header
- rarity
- slot
- item level
- requirements
- combat stats
- skill association
- rotation impact
- special effects
- power window
- tags
- training impact
- flavor

Material tooltip sections:

- rarity
- quantity
- quality stars if applicable
- crafting use
- source
- tags
- flavor

Quest tooltip sections:

- quest/use
- special state
- description
- flavor

Junk tooltip sections:

- sell value
- description
- flavor

## Rarity Visual Language

Base rarities:

- junk
- common
- uncommon
- rare
- epic
- legendary
- ephemeral
- mythical
- primal

Special rarities:

- cursed
- divine
- infernal
- phantom
- temporal
- secret
- galvanized

Normal rarities can use static accents.

Legendary+ and special rarities should have special visual treatment. Animation implementation is not required in MVP, but the intended animation language should be documented in the component styling comments or design notes.

### Legendary

Look:

- gold/orange frame
- distinct legendary effect block
- subtle premium glow

Animation direction:

- slow breathing border glow
- small shimmer across legendary effect title

### Ephemeral

Look:

- pale gold / spectral-gold frame
- legendary effect marked as maximized

Animation direction:

- soft fading shimmer
- translucent aura

### Mythical

Look:

- deep violet + gold frame
- ornate structure
- all rolls marked maxed

Animation direction:

- slow star-like sparkle on corners
- subtle flowing border

### Primal

Look:

- ancient red/gold/white frame
- strongest visual identity
- primal bonus has its own highlighted block

Animation direction:

- low-frequency pulsing aura
- occasional rune flicker

### Cursed

Look:

- dark red/black cracked overlay
- warning treatment
- curse section near top

Animation direction:

- faint red pulse
- crack/glitch flicker

### Divine

Look:

- white/gold clean glow
- sacred frame overlay

Animation direction:

- gentle radiance
- slow vertical light sweep

### Infernal

Look:

- black/red/orange heat treatment
- burning edge accent

Animation direction:

- ember particles
- heat shimmer

### Phantom

Look:

- blue/grey translucent ghosted frame
- remaining uses displayed prominently

Animation direction:

- fading opacity shimmer
- ghost trail flicker

### Temporal

Look:

- blue/gold time motif
- clock/rift accent
- context restriction block

Animation direction:

- slow rotating glyph/ring
- subtle time ripple

### Secret

Look:

- dark frame with hidden glyphs
- mystery accent
- revealed/unrevealed state

Animation direction:

- glyphs appear and vanish faintly

### Galvanized

Look:

- electric/charged overlay
- metallic bright edge
- temporary boost badge

Animation direction:

- short electric arc flicker
- charged border pulse

## MVP Page Layout

Suggested layout:

```text
Top Header:
  Character portrait/name/race/gender/level/rank

Left Column:
  Equipment slots
  Loadout selector

Center Column:
  Combat stats summary
  Stat breakdown tabs
  Rotation preview summary placeholder

Right Column:
  Inventory tabs
  Item details / compare panel
```

## Angular Notes

Use Angular 21.

The implementation should be componentized:

- character-sheet-page
- character-identity-header
- equipment-panel
- equipment-slot
- loadout-selector
- inventory-panel
- inventory-item-row/card
- stat-summary
- stat-breakdown
- item-tooltip
- equipment-tooltip
- material-tooltip
- quest-item-tooltip
- junk-tooltip

Use static/mock data first.

Keep the data model clean so it can connect to real game state later.
