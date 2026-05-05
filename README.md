# ProjectGrayVale — Combat MVP

A data-driven, tick-based RPG combat system built in TypeScript.  
This repository is a monorepo containing the core data layer, the combat engine, the world navigation graph, and the Angular game shell.  
The **MVP** proves out a single, fully runnable encounter end-to-end — no UI required.

---

## Module Overview

| Package | Path | Role |
|---|---|---|
| `@rinner/grayvale-core` | `core/` | Zod-validated schemas and TypeScript types for every combat entity: actors, abilities, effects, activities, rotations, deltas, and more. The single source of truth for all game data shapes. |
| `@rinner/grayvale-combat` | `combat/` | Tick-based combat engine. Runs encounters, accumulates deltas per tick, resolves rotations, and finalizes a `CombatDelta` that can be applied to persistent game state. |
| `@rinner/grayvale-worldgraph` | `worldgraph/` | World navigation primitives and `CombatNode` integration. Routes the player to a new world location based on the combat outcome (victory → forest clearing, defeat → town inn). Never imports `@rinner/grayvale-combat` directly — the caller injects a `CombatRunner`. |

---

## MVP Scenario

**Lyra Dawnmere** (Short Blade, level 3, 80 HP) encounters a **Coyote** (level 2, 45 HP) on the forest trail.

### Actors

| Actor | HP | Level | Key abilities |
|---|---|---|---|
| Lyra Dawnmere (`actor_player_mvp`) | 80 | 3 | Slashing Cut, Piercing Finisher, Auto Attack |
| Coyote (`actor_coyote`) | 45 | 2 | Scratch (applies Bleeding) |

### Rotation — Lyra (Short Blade)

Priority order, evaluated each action tick:

1. **Piercing Finisher** — fires when `effect_piercing_talon` stacks ≥ 2 (spends 2 stacks; piercing damage 5–12).
2. **Slashing Cut** — default action; deals slashing damage 2–5 and grants 1 `effect_piercing_talon` stack to self.
3. **Auto Attack** — fallback when nothing else applies (slashing 1–3).
4. **Instant Pierce** (reaction) — triggers on a successful dodge; costs no action slot (cooldown 2 ticks).

### Rotation — Coyote

Single ability: **Scratch** — slashing damage 2–6, 60% chance to apply 1 stack of `effect_bleeding` to the target (cooldown 4 ticks). Falls back to Auto Attack when Scratch is on cooldown.

### Encounter Flow

1. **Prep phase** — 2 ticks with no action resolution (actors prepare, log entries tagged `"prep"` are emitted).
2. **Combat phase** — ticks loop until one side reaches 0 HP.
3. **Ended phase** — outcome is `"victory"` or `"defeat"`.
4. `finalizeCombat()` converts the run state into a `CombatDelta` (HP changes, XP, effects, logs).
5. `runCombatNode()` (worldgraph) reads the outcome and moves the player to the correct location.

---

## Goals

- **End-to-end simulation** — a single TypeScript call chain runs a complete encounter with no external dependencies.
- **Deterministic tests** — `TestCombatRng` accepts a fixed float sequence so every test outcome is reproducible.
- **Data-driven everything** — actors, abilities, effects, rotations, and activities are plain data validated by Zod; the engine contains no hardcoded encounter logic.
- **Clean delta output** — `CombatDelta` carries exactly what changed (HP deltas, XP entries, effects applied/expired, combat log) so it can be applied to any persistence layer.
- **Decoupled graph routing** — `@rinner/grayvale-worldgraph` knows nothing about combat internals; it only reads `CombatDelta.outcome` to decide the next location.

---

## Non-Goals

The following are **explicitly out of scope** for the MVP and must not be added until the relevant design is approved:

- **UI or Angular shell** — the MVP runs headlessly; the game shell is a separate concern.
- **Party / multi-character party combat** — exactly one player actor per encounter.
- **Loot tables** — the `loot` field in `CombatDelta` exists but is always empty in the MVP.
- **Flee / retreat** — the `fled` outcome branch exists in `CombatBranches` but no MVP encounter triggers it.
- **Quest hooks** — combat completing a quest step is not wired in the MVP.
- **Persistence layer** — `CombatDelta` is produced but not applied to any saved state in these packages.
- **Balance tuning** — numbers are functional, not balanced for gameplay feel.
- **Boss timelines, multi-phase encounters, dungeon rooms** — single-room, single-enemy only.

---

## Combat Rules

### Tick Structure

Each tick runs in this order:

1. **DoT tick** — `"start_of_tick"` effects deal damage and are logged.
2. **Effect expiry** — effects whose duration has elapsed are removed.
3. **Cooldown step** — all cooldown counters are decremented by 1.
4. **Prep check** — if `currentTick < prepTicks`, skip action resolution and emit a `"prep"` log.
5. **Action resolution** — for each living actor, the compiled rotation selects the next ability.
6. **Damage application** — damage packets are resolved; resistances and modifiers are applied.
7. **Dodge** — each hit checks `dodgeChance`; on a dodge, damage becomes 0 and range increases by 1. The on-dodge reaction fires once per tick.
8. **Effect application** — abilities that `appliesEffects` apply stacks; abilities that `spendsEffects` consume them.
9. **Death check** — any actor at 0 HP triggers the `"ended"` phase.
10. **XP accumulation** — on victory, `enemyXp` entries are added to the delta, scaled by the difficulty profile's `xpMagicNumber` and any armor slot weights.

### Damage

Damage is rolled from a `{ min, max }` interval using the injected RNG.  
`DamageType` values in the MVP: `"slashing"` and `"piercing"`.  
The coyote has `resistances: { nature: 0.1 }` — irrelevant for the MVP abilities but present to verify resistance schema loading.

### Effects

| Effect ID | Type | Behaviour |
|---|---|---|
| `effect_bleeding` | DoT | Deals 25% of the last piercing damage taken per tick (slashing type); up to 5 stacks, source-specific; duration 4 ticks. |
| `effect_piercing_talon` | Resource stack | Each stack multiplies piercing damage taken by 1.05; max 3 stacks; consumed 2-at-a-time by Piercing Finisher. |
| `effect_attack_damage_down` | Debuff | Multiplies outgoing damage by 0.95; max 1 stack; duration 3 ticks. Applied by Instant Pierce. |

### Difficulty

The MVP activity uses difficulty `"story"`.  
`DifficultyProfile.xpMagicNumber` scales all XP rewards.  
When `difficultyProfiles` is omitted from `CombatTickContext`, the multiplier defaults to `1.0`.

---

## Data-Driven Approach

All game data is defined as static TypeScript objects validated by Zod schemas from `@rinner/grayvale-core`.  
**No JSON files are imported at compile time.** In the game shell, data is loaded via `HttpClient` from `assets/data/` and parsed with `.parse()` at the load boundary.

Example — wiring up a `CombatTickContext` from example fixtures:

```ts
import {
  mvpCombatActivity,
  playerActor,
  coyoteEnemy,
  slashingCut,
  piercingFinisher,
  autoAttack,
  coyoteScratch,
  bleedingEffect,
  piercingTalonStack,
  attackDamageDownEffect,
  shortBladeSkill,
} from "@rinner/grayvale-core";
import {
  createInitialCombatState,
  runCombat,
  finalizeCombat,
  compileShortBladeRotation,
  compileCoyoteRotation,
  DefaultCombatRng,
} from "@rinner/grayvale-combat";
import type { CombatTickContext } from "@rinner/grayvale-combat";

const playerRotation = compileShortBladeRotation([], shortBladeSkill);
const enemyRotation  = compileCoyoteRotation();

const ctx: CombatTickContext = {
  activity: mvpCombatActivity,
  abilities: {
    ability_slashing_cut:       slashingCut,
    ability_piercing_finisher:  piercingFinisher,
    ability_auto_attack:        autoAttack,
    ability_coyote_scratch:     coyoteScratch,
  },
  effects: {
    effect_bleeding:            bleedingEffect,
    effect_piercing_talon:      piercingTalonStack,
    effect_attack_damage_down:  attackDamageDownEffect,
  },
  rotations: {
    [mvpCombatActivity.playerActorId]:    playerRotation,
    [mvpCombatActivity.enemyActorIds[0]]: enemyRotation,
  },
};
```

Adding a new enemy, ability, or effect means:

1. Define a typed object that satisfies the relevant schema from `@rinner/grayvale-core`.
2. Pass it into the `CombatTickContext` lookup maps.
3. Reference its ID from an actor definition or rotation rule.

No engine code changes are required.

---

## Running Tests

Install dependencies from the repo root first (npm workspaces handles all packages):

```bash
npm install
```

### Run all tests

```bash
npm test
```

### Run tests for individual packages

```bash
# Core schemas and data fixtures
npm run test:core

# Combat engine (tick, rotation, finalize)
npm run test:combat

# WorldGraph (navigation, combat node routing)
npm run test:worldgraph
```

Tests use Jest with `ts-jest`. `TestCombatRng` provides a deterministic float sequence so combat outcomes are fully reproducible in CI.

---

## Running the MVP Simulation

Build the packages (combat depends on core's compiled output):

```bash
npm run build:core
npm run build:combat
npm run build:worldgraph
```

Then run the simulation from a TypeScript file or a REPL (e.g. `ts-node`):

```ts
import {
  mvpCombatActivity, playerActor, coyoteEnemy,
  slashingCut, piercingFinisher, autoAttack, coyoteScratch,
  bleedingEffect, piercingTalonStack, attackDamageDownEffect,
  shortBladeSkill,
} from "@rinner/grayvale-core";
import {
  createInitialCombatState,
  runCombat,
  finalizeCombat,
  compileShortBladeRotation,
  compileCoyoteRotation,
  DefaultCombatRng,
} from "@rinner/grayvale-combat";
import type { CombatTickContext } from "@rinner/grayvale-combat";

const ctx: CombatTickContext = {
  activity: mvpCombatActivity,
  abilities: {
    ability_slashing_cut:      slashingCut,
    ability_piercing_finisher: piercingFinisher,
    ability_auto_attack:       autoAttack,
    ability_coyote_scratch:    coyoteScratch,
  },
  effects: {
    effect_bleeding:           bleedingEffect,
    effect_piercing_talon:     piercingTalonStack,
    effect_attack_damage_down: attackDamageDownEffect,
  },
  rotations: {
    [mvpCombatActivity.playerActorId]:    compileShortBladeRotation([], shortBladeSkill),
    [mvpCombatActivity.enemyActorIds[0]]: compileCoyoteRotation(),
  },
};

const initial = createInitialCombatState(mvpCombatActivity, playerActor, [coyoteEnemy]);
const final   = runCombat(initial, ctx, new DefaultCombatRng());
const delta   = finalizeCombat(final);

console.log("Outcome      :", delta.outcome);
console.log("Ticks elapsed:", delta.ticksElapsed);
console.log("XP earned    :", delta.xp);
console.log("Log entries  :", delta.logs.length);
```

### WorldGraph routing (optional)

```ts
import { runCombatNode } from "@rinner/grayvale-worldgraph";
import type { CombatNode, CombatRunner } from "@rinner/grayvale-worldgraph";

const node: CombatNode = {
  activityId: "activity_coyote_mvp",
  branches: {
    victory: "forest_clearing",
    defeat:  "town_inn",
  },
};

// The runner wraps the combat engine call.
const runner: CombatRunner = (_activityId) => delta; // reuse delta from above

const result = runCombatNode(node, runner, { currentLocation: "forest_trail", sublocations: [] });
console.log("Next location:", result.nextLocation);
// → "forest_clearing" on victory, "town_inn" on defeat
```

---

## Repository Structure

```
core/        — @rinner/grayvale-core      (schemas, types, example data)
combat/      — @rinner/grayvale-combat    (tick engine, rotations, finalize)
worldgraph/  — @rinner/grayvale-worldgraph (navigation, CombatNode routing)
dialogue/    — @rinner/valeflow            (ValeFlow scripting engine)
game/        — Angular 21 game shell
docs/        — Design documents and gap tracking
```
