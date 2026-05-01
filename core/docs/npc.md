# Grayvale Core NPC Guide

## Purpose

Core exposes a lightweight NPC model for companions and other authored characters.
It stays data-first and intentionally avoids combat logic, AI behavior, or progression systems.

## Base Contracts

```ts
type NPCType = "combat" | "noncombat";

type NPCRole = "dps" | "healer" | "tank";

interface NPCProgression {
  level: number;
  adventurerRank: number;
}

interface NPC {
  id: string;
  name: string;
  description?: string;
  type: NPCType;
  skills: Record<string, number>;
  attributes: Record<string, number>;
  progression: NPCProgression;
  affection?: number;
  trust: number;
  trustCap: number;
  starLevel: number;
  role?: NPCRole;
  availableRoles?: NPCRole[];
  equipment?: EquippedItems;
  bonus?: string;
}
```

Design constraints:

- all fields are JSON-safe
- combat and non-combat NPCs share one base shape
- trust and star progression are stored as plain values
- equipment is allowed only for combat NPCs
- non-combat bonuses stay descriptive rather than executable

## Helpers

Core exports these helpers:

- `getTrustThreshold(starLevel)`
- `isCombatNPC(npc)`
- `isNonCombatNPC(npc)`
- `assertValidNPC(npc)`

Current helper behavior:

- `getTrustThreshold` doubles the requirement each star level starting from `100`
- `isCombatNPC` and `isNonCombatNPC` are type guards
- `assertValidNPC` checks that combat roles are consistent and that non-combat NPCs do not declare combat-only fields

## Example Usage

```ts
import {
  assertValidNPC,
  getTrustThreshold,
  isCombatNPC,
  type NPC
} from "@rinner/grayvale-core";

const npc: NPC = {
  id: "npc_lysa",
  name: "Lysa",
  description: "A disciplined frontline adventurer.",
  type: "combat",
  skills: {
    swordsmanship: 4
  },
  attributes: {
    strength: 8,
    vitality: 6
  },
  progression: {
    level: 10,
    adventurerRank: 3
  },
  trust: 40,
  trustCap: 100,
  starLevel: 1,
  role: "tank",
  availableRoles: ["tank", "dps"],
  equipment: {
    mainHand: "iron_sword",
    offHand: "tower_shield"
  }
};

assertValidNPC(npc);

if (isCombatNPC(npc)) {
  const nextTrustGate = getTrustThreshold(npc.starLevel + 1);
}
```

JSON example:

- [`examples/npc.json`](../examples/npc.json)

## Non-Goals

This module does not handle:

- combat turns
- AI decision making
- equipment validation against registries
- trust gain rules
- star-up side effects
