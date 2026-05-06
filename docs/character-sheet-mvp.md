Yes. Before I generate the GitHub issue-creation script, we should lock the scope so the issues are precise enough for an agent.

## Character Sheet Plan Scope

The character sheet should become the player-facing hub for:

```text
identity
combat math
equipment
loadouts
inventory
materials
quest items
tooltips
```

Even though character identity is not strictly combat, the sheet needs it because combat logic reads from the character model, equipment, skills, tags, stats, and effects.

---

# Proposed GitHub Project

## Project Name

```text
Grayvale Character Sheet MVP
```

## Short Description

Create the first Character Sheet MVP for Grayvale. The page should display character identity, equipment, inventory, loadouts, combat-relevant stats, stat math, item tooltips, and rarity-specific equipment presentation. The implementation should stay MVP-focused and data-driven.

---

# Proposed Issue Groups

## 1. Character Identity Model

Character sheet should show:

```text
name
race
gender
level
class/archetype if available
adventurer rank when unlocked
current activity state if relevant
```

Combat does not need race/gender immediately, but boss mechanics and resolver logic may later reference actor tags like `elf`, `human`, `construct`, etc.

So race should probably create tags.

Example:

```text
Race: Elf
Tags: elf, humanoid
```

Gender can remain display-only unless future systems use it.

Adventurer rank should be optional/unlocked.

---

## 2. Combat Math Summary

This is the most combat-important section.

The sheet should show final calculated combat stats, including buffed and nerfed values.

Example display:

```text
Strength: 40 (+20)
Mentality: 10 (-20)
Dodge: 18% (+12%)
Slashing Armor: 4
Piercing Armor: 2
Fire Resistance: -10
```

Color rules:

```text
green = improved/buffed above base
red = reduced/nerfed below base
neutral = unchanged
muted = inactive/expired/locked
gold/special = legendary or special effect source
```

Each number should be explainable through a breakdown.

Example:

```text
Strength 40
Base: 20
Iron Ring: +20
Final: 40
```

Example nerf:

```text
Mentality 10
Base: 30
Cursed Ring: -20
Final: 10
```

---

## 3. Stat Breakdown System

The character sheet should not just show final values. It should show where the math came from.

Suggested stat detail drawer:

```text
Strength
Base: 20
Equipment:
  Brutal Ring: +20
Buffs:
  Battle Chant: +5
Debuffs:
  Curse of Fog: -3
Final: 42
```

This becomes very important because your combat system is build-heavy.

---

## 4. Equipment Panel

Equipment slots should support at least:

```text
head
chest
gloves
legs
boots
main_hand
off_hand
ring
```

Later expansion:

```text
amulet
ring_1
ring_2
trinket
cloak
belt
tool
class_item
```

MVP can use the current slot list.

Equipment panel should show:

* equipped item icon/name
* rarity frame
* item level
* slot
* power-window state if relevant
* special rarity badges
* tooltip on hover/focus
* compare against inventory item
* loadout assignment

---

## 5. Loadouts

Allow character loadouts even if equipment system is not perfect yet.

MVP loadout model:

```text
loadout id
display name
equipment slot map
optional notes
active flag
```

Examples:

```text
Default
Fire Chasm
Dodge Build
Bossing
Gathering
```

MVP behavior:

* create loadout
* rename loadout
* select active loadout
* equip items into a loadout
* compare current vs selected loadout
* no complex validation required yet

Future behavior:

* resolver profile attached to loadout
* rotation profile attached to loadout
* activity restrictions
* galvanized item validation
* boss-specific warnings

---

## 6. Inventory System

Inventory must support equipment and non-equipment.

Item categories:

```text
equipment
materials
quest items
junk
consumables maybe later
```

MVP inventory sections:

```text
Equipment
Materials
Quest Items
Junk
```

Inventory item card/list should show:

* icon placeholder
* name
* rarity
* quantity
* item type
* item level if equipment
* quality stars if material and applicable
* special rarity badges
* tooltip

Materials need their own simpler tooltip, not equipment tooltip.

Quest items need a simple tooltip.

Junk can show sell value / flavor.

---

## 7. Material Inventory

Materials can have:

```text
rarity: common -> epic
special rarity: legendary, divine, infernal
quality stars for common -> epic only
quantity
source
crafting tags
```

Example:

```text
Rare Hide ★★★
Quantity: 12
Used by: Leatherworking
Tags: beast, hide, crafting_material
```

Special materials:

```text
Legendary Phoenix Ash
No quality stars
```

---

## 8. Quest Item Inventory

Quest items should show:

```text
name
quest association if known
description
usable/locked state
special rarity if any
```

They should not show combat math unless they are also temporal/special equipment.

Example:

```text
Ashen Keystone
Quest Item • Temporal
Used to open Fire Chasm final chamber.
```

---

## 9. Tooltip System

Tooltips should share a visual family but differ by item type.

Required tooltip families:

```text
equipment tooltip
material tooltip
quest item tooltip
junk tooltip
```

Equipment tooltips are the richest.

They show:

```text
header
rarity
slot
item level
requirements
combat stats
skill association
rotation impact
special effects
power window
tags
training impact
flavor
```

Materials show:

```text
rarity
quantity
quality stars if applicable
crafting use
source
tags
flavor
```

Quest items show:

```text
quest/use
special state
description
flavor
```

Junk shows:

```text
sell value
description
flavor
```

---

# Rarity Tooltip Visual Design

Normal base rarities can share the basic tooltip frame with different accents.

## Junk

Look:

```text
dull grey frame
worn paper/dusty look
low emphasis
```

Purpose:

```text
useless or weak, but may sell
```

## Common

Look:

```text
plain neutral frame
minimal accent
```

## Uncommon

Look:

```text
soft green/blue accent
small bonus highlight
```

## Rare

Look:

```text
stronger blue accent
subtle glow
```

## Epic

Look:

```text
purple accent
more premium frame
clear build identity
```

---

# Legendary+ Tooltip Special Looks

These should feel visually special. Animation does not need implementation now, but issues should describe intended motion language.

## Legendary

Look:

```text
gold/orange frame
distinct legendary effect block
subtle ember/glow pulse
```

Animation direction:

```text
slow breathing border glow
small shimmer across legendary effect title
```

Purpose:

```text
has legendary effect with variable rolls
```

## Ephemeral

Look:

```text
pale gold / translucent spectral-gold frame
legendary effect marked as maximized
```

Animation direction:

```text
soft fading shimmer
slightly translucent aura
```

Purpose:

```text
legendary effect is maxed
```

## Mythical

Look:

```text
deep violet + gold frame
more ornate structure
all rolls marked maxed
```

Animation direction:

```text
slow star-like sparkle on corners
subtle flowing border
```

Purpose:

```text
legendary effect and all bonuses are maxed
```

## Primal

Look:

```text
ancient red/gold/white frame
strongest visual identity
primal bonus has its own highlighted block
```

Animation direction:

```text
low-frequency pulsing aura
occasional rune flicker
strong but not noisy
```

Purpose:

```text
mythical + tiny extra primal bonus
```

---

# Special Rarity Tooltip Looks

Special rarities can stack with base rarity. They should appear as badges and special sections.

## Cursed

Look:

```text
dark red/black cracked overlay
warning treatment
curse section near top
```

Animation direction:

```text
faint red pulse
small crack/glitch flicker
```

Must be obvious because it has major downsides.

## Divine

Look:

```text
white/gold clean glow
soft sacred frame overlay
```

Animation direction:

```text
gentle radiance
slow vertical light sweep
```

## Infernal

Look:

```text
black/red/orange heat treatment
burning edge accent
```

Animation direction:

```text
ember particles
heat shimmer
```

## Phantom

Look:

```text
blue/grey translucent ghosted frame
uses remaining displayed prominently
```

Animation direction:

```text
fading opacity shimmer
ghost trail flicker
```

Must show limited uses clearly.

## Temporal

Look:

```text
blue/gold time motif
clock/rift accent
context restriction block
```

Animation direction:

```text
slow rotating glyph/ring
subtle time ripple
```

Must show where/when the item works.

## Secret

Look:

```text
dark frame with hidden glyphs
mystery accent
revealed/unrevealed state
```

Animation direction:

```text
glyphs appear and vanish faintly
```

Should feel discovered, not merely rare.

## Galvanized

Look:

```text
electric/charged overlay
metallic bright edge
temporary boost badge
```

Animation direction:

```text
short electric arc flicker
charged border pulse
```

Must show whether galvanized is allowed in current activity.

---

# Character Sheet Page Layout

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
  Rotation preview summary

Right Column:
  Inventory tabs
  Item details / compare panel
```

Sections:

```text
Identity
Equipment
Loadouts
Combat Math
Derived Stats
Resistances
Resources
Inventory
Tooltips
Comparison
```

---

# GitHub Issue Plan

I would create these issues:

## Issue 1 — Define Character Sheet MVP scope and README

Defines goals, non-goals, page purpose, and data-driven approach.

## Issue 2 — Define character identity and sheet models

Includes:

```text
race
gender
level
adventurer rank
character tags
selected loadout
inventory reference
```

## Issue 3 — Define stat math and modifier breakdown models

Includes:

```text
base stats
equipment modifiers
buff modifiers
debuff modifiers
final stat
green/red display state
breakdown source list
```

## Issue 4 — Define equipment slot and loadout models

Includes:

```text
equipment slots
loadout slot map
active loadout
loadout validation placeholder
```

## Issue 5 — Define inventory item category models

Includes:

```text
equipment
materials
quest items
junk
quantity
quality stars
rarity
special rarity
```

## Issue 6 — Design equipment panel UI

Includes:

```text
slot layout
equipped item card
empty slot state
rarity frame
item level
power window badge
tooltip trigger
```

## Issue 7 — Design inventory UI

Includes:

```text
tabs
filters
search maybe
equipment/material/quest/junk sections
quantity display
quality stars
rarity badges
```

## Issue 8 — Design combat math UI

Includes:

```text
stat summary
green buffed values
red nerfed values
expandable breakdown
resistance display
resource display
derived stats
```

## Issue 9 — Design tooltip component system

Includes:

```text
shared tooltip shell
equipment tooltip
material tooltip
quest tooltip
junk tooltip
comparison mode
```

## Issue 10 — Design rarity tooltip visual language

Includes:

```text
base rarities
legendary+
special rarities
animation descriptions
badge rules
special sections
```

## Issue 11 — Implement character sheet data fixtures

Includes sample:

```text
player
old dagger
rags
worn leather chestpiece
ring with strength up / mentality down
materials
quest item
junk item
```

## Issue 12 — Implement Character Sheet MVP page

Wires the page together with mock/static data first.

## Issue 13 — Add tests for stat math and loadout calculations

Tests:

```text
buffed stat green
nerfed stat red
equipment modifiers included
inactive power window ignored
loadout swaps stat result
```

## Issue 14 — Add documentation for character sheet data rules

Explains how character sheet reads combat-related models.

---
