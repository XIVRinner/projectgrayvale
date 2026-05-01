# Companions

[Activity Nodes](./activity_nodes.md) | [Classes](./classes.md)

## Companion Model

Companions are split into combat and non-combat roles.

## Companion Rules

### Core Fields

- Companion name
- Companion type
- Star level
- Trust level
- Companion level
- Primary role
- Secondary role
- Equipment access
- System bonus or combat function

### Companion Types

- **Combat companions:** Participate in combat and use equipment.
- **Non-combat companions:** Provide bonuses to systems such as crafting, gathering, or kingdom development.

## Combat Companions

### Gear Slots

Combat companions have 4 gear slots:

- Weapon
- Gear
- Jewelry
- Special

### Role Efficiency

- **Primary role:** 100% efficiency
- **Secondary role:** ~60% efficiency

### Role Notes

- A combat companion must have one primary role.
- A combat companion may have one secondary role.
- Secondary role performance is intentionally weaker than primary role performance.

## Non-Combat Companions

### Function

Non-combat companions do not use the combat role model.

They provide system bonuses such as:

- Crafting support
- Gathering support
- Kingdom support
- Other passive utility

## Star Level System

### Rule

Star levels start at 1 and scale exponentially in requirement.

### Progression Notes

- Each new star level requires more trust than the previous one.
- Star progression is a long-term companion growth path.
- This document defines progression structure, not balance values.

### Example Star Requirement Structure

| Star Level | Relative Requirement |
| --- | --- |
| 1 | Base |
| 2 | Increased |
| 3 | Exponential step up |
| 4 | Exponential step up |
| 5 | Exponential step up |

## Trust Requirements

### Rule

Trust is required for companion level progression.

### Trust by Level

| Level | Trust Requirement |
| --- | --- |
| 1 | 0 |
| 2 | 10 |
| 3 | 25 |
| 4 | 45 |
| 5 | 70 |
| 6 | 100 |
| 7 | 140 |
| 8 | 195 |
| 9 | 270 |
| 10 | 370 |

**Note:**  
This is a structured exponential curve for documentation purposes and can be tuned later.

## Level 1-10 Progression

### Progression Rules

- Companion levels run from 1 to 10 in this base specification.
- Trust gates level advancement.
- Event milestones are included to support progression beats.

### Level Milestones

| Level | Trust Required | Event |
| --- | --- | --- |
| 1 | 0 | Recruitment event |
| 2 | 10 | Intro dialogue event |
| 3 | 25 | Minor bond event |
| 4 | 45 | Role training event |
| 5 | 70 | Personal story event |
| 6 | 100 | Trust checkpoint event |
| 7 | 140 | Secondary growth event |
| 8 | 195 | Deeper bond event |
| 9 | 270 | Advanced companion event |
| 10 | 370 | Major progression event |

## Authoring Rules

When defining a new companion:

- Set whether the companion is combat or non-combat.
- If combat, assign primary and optional secondary roles.
- If combat, use all 4 gear slots.
- If non-combat, define the supported system bonus.
- Keep star growth tied to escalating trust requirements.
