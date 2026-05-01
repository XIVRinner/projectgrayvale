# Grayvale WorldGraph End User Guide

## What This Package Is

This package defines how Grayvale locations connect and how movement state changes over time.
Use it when you need a simple, deterministic model for moving between places, checking data-driven access requirements, tracking nested sublocations, and reacting to lifecycle notifications.

## What You Can Do With It

You can use this package to:

- define locations by ID
- define directed travel connections between locations
- attach generic guards to edges and locations
- check whether a move is currently allowed by the graph
- update world state immutably
- track nested sublocation navigation
- observe movement state changes through a router
- observe enter and leave lifecycle events through a router

You should not use this package for:

- movement permissions based on gameplay rules
- quest or activity execution
- save persistence
- UI framework behavior
- delta application or simulation hooks

## Mental Model

Think of the package in two parts:

- `world-graph`
  The pure movement rules, guard evaluation helpers, and state update helpers.
- `router`
  The observable wrapper that stores current state and emits updates and lifecycle events.

If you only need deterministic logic, use the pure functions.
If you need subscribers to react to movement changes, use `LocationRouter`.

## Core Types

The main data types are:

- `Location`
- `Edge`
- `WorldGraph`
- `WorldState`
- `Guard`
- `GuardContext`
- `LifecycleEvent`

Example:

```ts
import type { WorldGraph, WorldState } from "@rinner/grayvale-worldgraph";

const graph: WorldGraph = {
  locations: {
    town: { id: "town", sublocations: ["square", "inn"] },
    forest: {
      id: "forest",
      sublocations: ["grove"],
      guards: [{ type: "location_access", params: { key: "forest_pass" } }]
    }
  },
  edges: [
    {
      from: "town",
      to: "forest",
      guards: [{ type: "player_level_at_least", params: { minLevel: 2 } }]
    }
  ]
};

const state: WorldState = {
  currentLocation: "town",
  sublocations: []
};
```

## Movement Checks

Use `canMove(graph, from, to, context?, resolver?)` when you want a simple yes or no answer.

Example:

```ts
import {
  canMove,
  type GuardContext,
  type GuardResolver
} from "@rinner/grayvale-worldgraph";

const context: GuardContext = {
  player,
  npcs,
  world: state
};

const resolver: GuardResolver = (guard, current) => {
  if (guard.type === "player_level_at_least") {
    return (
      typeof guard.params?.minLevel === "number" &&
      current.player.progression.level >= guard.params.minLevel
    );
  }

  if (guard.type === "location_access") {
    return guard.params?.key === "forest_pass";
  }

  return false;
};

const allowed = canMove(graph, "town", "forest", context, resolver);
```

Current behavior:

- movement is valid only when the exact directed edge exists
- edge guards must pass when present
- destination location guards must pass when present
- missing edges return `false`
- missing context or resolver causes guarded movement to fail safely

## Guard Model

Guards are plain serializable data:

```ts
type Guard = {
  type: string;
  params?: Record<string, unknown>;
};
```

Important rules:

- WorldGraph does not decide what `guard.type` means
- your game layer provides a `GuardResolver`
- unknown guards should resolve to `false`
- multiple guards use AND logic

## Immutable State Updates

Use the pure helpers when you want to manage `WorldState` yourself.

Available helpers:

- `move(state, to)`
- `enterSublocation(state, subId)`
- `leaveSublocation(state)`

Example:

```ts
import {
  move,
  enterSublocation,
  leaveSublocation
} from "@rinner/grayvale-worldgraph";

const moved = move(state, "forest");
const nested = enterSublocation(moved, "grove");
const backOneLevel = leaveSublocation(nested);
```

Important details:

- `move` changes `currentLocation`
- `move` clears all current sublocations
- `enterSublocation` pushes onto the stack
- `leaveSublocation` pops the last entry
- none of these helpers mutate the original state

## Using The Router

Use `LocationRouter` when you want one object to own the current state and notify subscribers.

Example:

```ts
import { LocationRouter } from "@rinner/grayvale-worldgraph";

const router = new LocationRouter(graph, state);

const subscription = router.getState$().subscribe((nextState) => {
  console.log(nextState.currentLocation, nextState.sublocations);
});

const lifecycleSubscription = router.getLifecycle$().subscribe((event) => {
  console.log(event.type, event.locationId, event.sublocations);
});

router.moveTo("forest");
router.enterSublocation("grove");
router.leaveSublocation();

subscription.unsubscribe();
lifecycleSubscription.unsubscribe();
```

Available methods:

- `getState$()`
- `getLifecycle$()`
- `getSnapshot()`
- `moveTo(to)`
- `enterSublocation(id)`
- `leaveSublocation()`

## Router Behavior

Current rules:

- `moveTo` validates movement with `canMove`
- invalid movement does nothing
- sublocation entry does not validate authored sublocations yet
- movement emits `onLeave` before the state changes and `onEnter` after it changes
- sublocation entry emits `onEnter`
- sublocation leave emits `onLeave`
- `getState$()` exposes a readonly observable, not the internal `BehaviorSubject`
- `getLifecycle$()` exposes a readonly observable, not the internal `Subject`
- `getSnapshot()` returns the current state value

## Common Workflow

Typical usage looks like this:

1. author a `WorldGraph`
2. create an initial `WorldState`
3. decide whether you want pure helpers or the router
4. apply moves and sublocation changes
5. react to state changes if you are using `LocationRouter`

## Common Mistakes To Avoid

- expecting edges to work in both directions automatically
- expecting WorldGraph to know what a custom guard type means on its own
- putting RxJS into code that should stay in the pure graph layer
- mutating `WorldState` directly
- assuming `moveTo` throws on invalid travel
- assuming sublocation IDs are validated against location metadata already
- assuming lifecycle events execute gameplay behavior by themselves
- adding gameplay rules to the router instead of keeping it minimal

## Recommended Workflow For Consumers

If you are building higher-level gameplay on top of this package:

1. keep authored map structure in `WorldGraph`
2. keep gameplay-specific rule checks inside your guard resolver or higher layers
3. use `canMove` as the lowest-level graph check
4. let the router handle observation, not interpretation

This keeps the foundation small and makes future rule layers easier to add without rewriting movement primitives.
