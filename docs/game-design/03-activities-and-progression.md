# Activities and Progression

[Back to index](../game-design.md) | [Previous: Gameplay Loops](./02-gameplay-loops.md) | [Next: Classes and Combat](./04-classes-and-combat.md)

## Tick System

**Definition:**  
Everything in the game progresses through ticks (time units).

**Example formula:**

```text
ticksRequired = baseTicks * (nodeDifficulty / playerSkillModifier)
```

**Notes:**

- Faster ticks = faster progression
- Higher difficulty = better rewards

## Activities System

### Types

- Combat
- Gathering
- Crafting
- Social (future)
- Exploration

### Difficulty Scaling

Each activity has:

- `id`
- `name`
- `description`
- `tags`
- `governingAttributes`
- `difficulty` as an arbitrary number
- optional attached `itemId`

**Rule:**  
Activity difficulty is the main authored input used by higher-level systems to determine gains, item outcomes, and scaling.

### Tick Output

Each tick of an active activity should emit an `activity_tick` delta onto the central message bus.

That delta should include:

- `activityId`
- `difficulty`
- `governingAttributes`
- `tags`
- `tickDelta`
- optional `itemId`

This allows systems such as quests to consume activity progress later without directly coupling to the tick runner.

## Adventurer Rank

**Ranks:** G -> SSS

**Purpose:**

- Content gating
- Progression indicator
- System unlocks
