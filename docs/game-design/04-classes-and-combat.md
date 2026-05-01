# Classes and Combat

[Back to index](../game-design.md) | [Previous: Activities and Progression](./03-activities-and-progression.md) | [Next: Companions and Social Systems](./05-companions-and-social-systems.md)

## Dynamic Class System

Classes are not fixed.

**Formula:**

```text
Class = Equipped Weapon + Equipped Armor Configuration + Passive Skills
```

**Examples:**

- Staff + Robe -> Wizard
- Sword + Heavy Armor -> Knight
- Scythe + Dark Focus -> Dark Harvester (unique)

**Equipment model notes:**

- Weapons and armor are authored as equipment items with explicit allowed slots.
- Armor is split into slotted pieces such as `head`, `body`, `legs`, and `hands`.
- Item scaling should be data-driven through one or more governing skills plus optional attributes.

**Class properties:**

- Combat role (DPS / Tank / Support)
- Raid abilities
- Passive bonuses

**Design note:**  
No balance via nerfs; content will counter builds instead.

## Combat System

### Modes

- Solo (auto / semi-auto)
- Dungeon (1-4 players)
- Raid (2-8 players)

### Core Mechanics

- Tick-based combat
- Cooldowns
- Class abilities
- Elemental interactions

### Raid Philosophy

Raids are mechanic checks, not just stat checks.

**Examples:**

- Fire boss -> requires water interaction
- Shield phases -> require specific class roles

## Dungeons vs Raids

| Feature | Dungeons | Raids |
| --- | --- | --- |
| Length | Short | Long |
| Team Size | 1-4 | 2-8 |
| Complexity | Low | High |
| Rewards | General loot | Specialized gear |
| Mechanics | Simple | Complex / Required |
