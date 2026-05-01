# Grayvale WorldGraph Agentic Development Notes

## Why This Document Exists

This guide is for an agent or automated contributor that needs to evolve the package without breaking the intended separation between pure world logic and reactive routing.

The main context to preserve is architectural discipline:

- `src/world-graph` is pure and deterministic
- `src/router` owns RxJS usage
- guard meaning is external and data-driven
- lifecycle events are notifications only

## Core Design Intent

This package is meant to be a stable foundation for location traversal.

That means:

- plain serializable graph data
- plain serializable guard data
- immutable world state transitions
- explicit directed movement
- no hidden rule execution
- no framework leakage into the pure layer

If a change starts turning the package into a gameplay engine, it is probably drifting out of scope.

## High-Value Invariants

Preserve these unless the user explicitly changes the direction:

- `Location`, `Edge`, `WorldGraph`, and `WorldState` remain plain data contracts.
- `Guard`, `GuardContext`, `GuardResolver`, and `LifecycleEvent` remain plain data or function contracts.
- `src/world-graph` does not import RxJS.
- pure helpers do not mutate inputs.
- `canMove` stays a deterministic edge-plus-guard check using only explicit inputs.
- `move` resets `sublocations` to an empty array.
- `enterSublocation` and `leaveSublocation` remain immutable.
- `LocationRouter` exposes state as an `Observable`, not a writable subject.
- `LocationRouter` exposes lifecycle events as an `Observable`, not a writable subject.
- invalid `moveTo` requests currently no-op rather than throw.
- Core does not implement specific guard meanings.
- unknown guards should fail safely through the resolver contract rather than throw.
- lifecycle emission must not become hidden rule execution.
- no rule engines, deltas, or activity integration are added implicitly.

## Current Surface Area Summary

Primary exports:

- [`src/index.ts`](../src/index.ts)
- [`src/world-graph/graph.types.ts`](../src/world-graph/graph.types.ts)
- [`src/world-graph/guard.types.ts`](../src/world-graph/guard.types.ts)
- [`src/world-graph/graph.logic.ts`](../src/world-graph/graph.logic.ts)
- [`src/world-graph/guard.logic.ts`](../src/world-graph/guard.logic.ts)
- [`src/router/lifecycle.types.ts`](../src/router/lifecycle.types.ts)
- [`src/router/locationRouter.ts`](../src/router/locationRouter.ts)

Current package responsibilities:

- define map nodes and directed edges
- define generic guards and a resolver contract
- define runtime location state
- validate movement through edges and optional guards
- update state immutably
- expose a reactive state holder
- emit lifecycle notifications without behavior

## Change Strategy

When modifying the package, use this order:

1. update pure graph types first if the contract changes
2. update pure graph helpers next
3. update router behavior only after the pure layer is settled
4. update docs if public behavior changed
5. add or update Jest tests
6. run `npm run check`, `npm test`, and `npm run build`

This order keeps the router dependent on the pure layer rather than the other way around.

## When To Add New Files

Add to `src/world-graph` when:

- a new pure type is required
- a deterministic helper is required
- a serialization-safe graph utility is needed
- a generic guard helper is needed without embedding game logic

Add to `src/router` when:

- observable state orchestration is needed
- router-specific adapter behavior is needed
- RxJS coordination is required without contaminating the pure layer

Add to `docs` when:

- public behavior changes
- a new invariant needs preserving
- higher-level contributors could misunderstand the boundary between graph and router

Add tests near the affected layer when:

- pure movement rules change
- router emission behavior changes
- a bug fix needs regression protection

## Anti-Patterns

Avoid these unless explicitly requested:

- importing RxJS into `src/world-graph`
- mutating `WorldState` in place
- embedding side effects in `move`, `enterSublocation`, or `leaveSublocation`
- hardcoding specific guard types in Core
- making `canMove` depend on ambient globals rather than explicit `context` and `resolver`
- having the router interpret gameplay meaning beyond state transition sequencing
- executing rules from lifecycle emissions inside this package
- mixing delta systems into this package
- turning `Location` or `WorldState` into class-based runtime entities

## Likely Safe Extensions

Likely safe next steps:

- additional pure graph query helpers
- convenience constructors for graph authoring
- readonly validation helpers for graph shape
- separate adapters that consume `LocationRouter`
- resolver helper composition in consumer layers
- more examples and docs

Likely unsafe without a deliberate scope change:

- event buses inside the pure layer
- gameplay rule execution during movement
- guard DSLs or embedded scripting
- dynamic scripting for travel
- hidden persistence or save syncing
- reactive dependencies scattered across pure graph files

## Practical Navigation

Start here when editing:

- public entry: [`src/index.ts`](../src/index.ts)
- pure graph types: [`src/world-graph/graph.types.ts`](../src/world-graph/graph.types.ts)
- guard types: [`src/world-graph/guard.types.ts`](../src/world-graph/guard.types.ts)
- pure graph logic: [`src/world-graph/graph.logic.ts`](../src/world-graph/graph.logic.ts)
- guard logic: [`src/world-graph/guard.logic.ts`](../src/world-graph/guard.logic.ts)
- lifecycle types: [`src/router/lifecycle.types.ts`](../src/router/lifecycle.types.ts)
- router: [`src/router/locationRouter.ts`](../src/router/locationRouter.ts)
- tests: [`src/world-graph/graph.test.ts`](../src/world-graph/graph.test.ts), [`src/world-graph/guard.test.ts`](../src/world-graph/guard.test.ts), [`src/router/router.test.ts`](../src/router/router.test.ts)

## Expected Contributor Behavior

A good agent change in this package should be:

- small in scope
- explicit about assumptions
- faithful to the pure versus reactive split
- backed by tests when behavior changes
- careful not to introduce mechanics the user has not asked for
