# Grayvale WorldGraph Technical Documentation

## Purpose

`@rinner/grayvale-worldgraph` is the foundational location and movement package for Grayvale.
It provides a deterministic graph model for locations, a data-driven guard evaluation pipeline, and a small reactive router for state observation.

The package is intentionally limited to:

- location and edge definitions
- generic guard definitions and evaluation
- immutable world state updates
- deterministic movement validation
- sublocation stack updates
- lifecycle event emission
- a reactive router built on top of the pure graph layer
- tests for pure logic and router behavior

The package intentionally excludes:

- rule execution
- delta integration
- lifecycle behavior
- activity systems
- persistence concerns

## Architecture

The source tree is split into two layers:

- `src/world-graph`
  Contains pure types plus deterministic immutable helpers.
- `src/router`
  Contains the RxJS-powered state holder and observable routing interface.

This boundary is the main architectural rule for the package.
All world logic must remain usable without RxJS.
RxJS exists only to observe and manage state transitions in the router layer.

## WorldGraph Layer

Location:

- [`src/world-graph`](../src/world-graph)

Exports:

- `type Location`
- `type Edge`
- `type WorldGraph`
- `type WorldState`
- `type Guard`
- `type GuardContext`
- `type GuardResolver`
- `evaluateGuard(guard, context, resolver)`
- `evaluateGuards(guards, context, resolver)`
- `canMove(graph, from, to, context?, resolver?)`
- `move(state, to)`
- `enterSublocation(state, subId)`
- `leaveSublocation(state)`

Core data contracts:

- `Location`
  Minimal node definition with an `id`, optional authored `sublocations`, and optional `guards`.
- `Edge`
  A directed connection from one location ID to another with optional `guards`.
- `WorldGraph`
  A location lookup plus a flat list of directed edges.
- `WorldState`
  Runtime position state with `currentLocation` and a sublocation stack.
- `Guard`
  A serializable `{ type, params? }` record whose meaning is defined externally.
- `GuardContext`
  The runtime data passed to guard evaluation, including `player`, `npcs`, and `world`.
- `GuardResolver`
  An external function that decides whether a guard passes.

## Guard Evaluation

Location:

- [`src/world-graph/guard.types.ts`](../src/world-graph/guard.types.ts)
- [`src/world-graph/guard.logic.ts`](../src/world-graph/guard.logic.ts)

Current guard model:

- no hardcoded guard types in WorldGraph
- no enum-based dispatch
- no DSL or rule engine
- all guard meaning lives in the externally provided resolver

Current helper behavior:

- `evaluateGuard` delegates a single guard to the resolver and returns its boolean result
- `evaluateGuards` returns `true` when guards are missing or empty
- `evaluateGuards` applies AND logic across the guard list
- `evaluateGuards` short-circuits on first failure

Unknown guard handling:

- the package expects unknown guards to resolve to `false`
- the safe behavior lives in the resolver implementation
- Core does not throw for unknown guard types by itself

## Movement Rules

Current movement behavior is intentionally small, but now supports optional edge and location guards.

`canMove(graph, from, to, context?, resolver?)` returns `true` only when:

- a matching edge exists where `edge.from === from`
- and `edge.to === to`
- and edge guards pass when present
- and destination location guards pass when present

Otherwise it returns `false`.

Current constraints:

- edges are directional
- no reverse traversal is implied automatically
- guard meaning is not defined in Core
- no location existence validation is enforced by `canMove`
- guarded movement without both `context` and `resolver` returns `false`

## State Update Helpers

Current immutable helpers:

- `move(state, to)`
  Returns a new `WorldState` with `currentLocation` updated and `sublocations` reset to `[]`.
- `enterSublocation(state, subId)`
  Returns a new `WorldState` with `subId` appended to the sublocation stack.
- `leaveSublocation(state)`
  Returns a new `WorldState` with the last sublocation removed.
  If the stack is empty, it returns the original state unchanged.

Important invariants:

- incoming `WorldState` objects are never mutated
- returned state is derived only from explicit inputs
- sublocation navigation does not validate against authored location metadata yet

## Router Layer

Location:

- [`src/router`](../src/router)

Primary export:

- `LocationRouter`

Current responsibilities:

- own the current `WorldState`
- expose the current state as a readonly observable
- expose lifecycle events as a readonly observable
- provide an imperative API for movement and sublocation navigation
- delegate all world rules to the pure graph layer

Internal state shape:

```ts
private state$: BehaviorSubject<WorldState>;
private lifecycle$: Subject<LifecycleEvent>;
```

Public API:

- `getState$(): Observable<WorldState>`
- `getLifecycle$(): Observable<LifecycleEvent>`
- `getSnapshot(): WorldState`
- `moveTo(to: string): void`
- `enterSublocation(id: string): void`
- `leaveSublocation(): void`

Lifecycle event contract:

- `type LifecycleEvent = { type: "onEnter" | "onLeave"; locationId: string; sublocations: string[] }`

## Router Behavior

`LocationRouter.moveTo(to)`:

- reads the current snapshot
- validates the requested move with `canMove`
- emits `onLeave` for the previous location before moving
- applies `move` only when the edge is valid
- emits `onEnter` for the new location after state update
- performs a no-op for invalid movement

`LocationRouter.enterSublocation(id)`:

- applies the pure `enterSublocation` helper
- emits the resulting state immediately
- emits `onEnter` with the updated sublocation stack

`LocationRouter.leaveSublocation()`:

- emits `onLeave` with the current sublocation stack
- applies the pure `leaveSublocation` helper
- safely no-ops when already at the top level

## Determinism And Scope

The package should remain deterministic under these rules:

- graph helpers accept plain inputs and return plain outputs
- no helper reads ambient state
- no helper performs I/O
- the router only sequences pure transitions over a held state value

The router is reactive, but it is not a rule engine.
It should not become a place for implicit gameplay behavior.
Lifecycle emissions are notifications only and must not gain hidden rule execution.

## Test Coverage

Current tests live in:

- [`src/world-graph/graph.test.ts`](../src/world-graph/graph.test.ts)
- [`src/world-graph/guard.test.ts`](../src/world-graph/guard.test.ts)
- [`src/router/router.test.ts`](../src/router/router.test.ts)

Covered behavior:

- `canMove` returns expected results for present and missing edges
- guard evaluation supports single and multiple guards
- guarded movement respects edge and location guards
- unknown guards resolve safely through the resolver contract
- `move` updates location and clears sublocations
- sublocation enter and leave are immutable
- router subscribers receive new state values
- router movement respects `canMove`
- router lifecycle events emit in the expected order
- router snapshot stays aligned with observable emissions

## Build And Test

Useful commands:

```bash
npm run check
npm test
npm run build
```

Expected workflow:

1. update pure graph contracts or helpers first
2. update the router only if observable behavior needs to change
3. add or update tests
4. run typecheck, tests, and build

## Extension Guidance

Safe future additions:

- richer location metadata
- graph construction helpers
- serialization helpers
- validation utilities that remain outside the pure movement rules
- alternate router adapters that still depend on the same pure graph helpers

Avoid introducing the following into this package unless scope changes deliberately:

- embedded gameplay rule systems
- hardcoded guard meaning inside Core
- side effects in pure helpers
- RxJS imports inside `src/world-graph`
- hidden mutation of router state
