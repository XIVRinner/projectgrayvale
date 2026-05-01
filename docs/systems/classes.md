# Classes

[Activity Nodes](./activity_nodes.md) | [Companions](./companions.md)

## Class Model

**Rule:**  
A class is defined by weapon, armor, and a valid configuration.

**Important:**  
Not every equipment combination creates a valid class.

## Class Rules

### Core Fields

- Class name
- Identity
- Primary role
- Weapon requirement
- Armor requirement
- Armor slot coverage
- Off-hand requirement (if applicable)
- Valid configuration
- Core behavior

### Configuration Rules

- Weapon is required.
- Armor is required.
- Armor pieces use explicit slots such as `head`, `body`, `legs`, and `hands`.
- Off-hand is required only when the class needs it.
- A class exists only if the full configuration is valid.
- Invalid combinations do not create fallback classes automatically.

### Equipment Authoring Notes

- Weapons and armor should be authored as equipment items with explicit `allowedSlots`.
- Scaling should remain data-driven and may reference multiple skills plus zero or more attributes.
- Class definitions should rely on item categories and valid configurations, not hardcoded stat logic.

## Class Definitions

### Reaper

- **Identity:** Fast scythe user focused on offensive pressure
- **Primary role:** DPS
- **Weapon requirement:** Scythe
- **Armor requirement:** Medium
- **Off-hand requirement:** None specified
- **Valid configuration:** Scythe + Medium
- **Core behavior:** Sustains damage output through aggressive, offense-first combat patterns

### Bruiser

- **Identity:** Heavy-hitting frontline attacker with durable medium gear
- **Primary role:** DPS
- **Weapon requirement:** Hammer
- **Armor requirement:** Medium
- **Off-hand requirement:** None specified
- **Valid configuration:** Hammer + Medium
- **Core behavior:** Trades speed for impact and stays active in close-range combat

### Knight

- **Identity:** Defensive frontline protector
- **Primary role:** Tank
- **Weapon requirement:** Sword
- **Armor requirement:** Heavy
- **Off-hand requirement:** Shield
- **Valid configuration:** Sword + Shield + Heavy
- **Core behavior:** Anchors the front line and absorbs pressure for the rest of the party

### Mage

- **Identity:** Element-based spellcaster
- **Primary role:** DPS
- **Weapon requirement:** Staff
- **Armor requirement:** Robe
- **Off-hand requirement:** None specified
- **Valid configuration:** Staff + Robe
- **Core behavior:** Fights through elemental specialization rather than physical pressure

## Authoring Rules

When defining a new class:

- Start from a valid equipment configuration.
- Define a clear identity.
- Assign one primary role.
- Describe behavior at a high level only.
- Do not add abilities unless they are explicitly needed.
