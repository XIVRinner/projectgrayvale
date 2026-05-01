# Grayvale Core Agentic Development Notes

## Why This Document Exists

This guide is for an agent or automated contributor that needs to modify the package safely without rediscovering the intent from scratch.

The main context to preserve is architectural discipline:

- `src/core` is type-only
- `src/data` owns runtime validation and registries
- the package is data-centric, not rule-centric

## Core Design Intent

This package is meant to be boring in the best way:

- stable contracts
- strict validation
- JSON-safe payloads
- ID-based references

If a proposed change starts adding behavior-heavy concepts, it is probably drifting out of scope.

## High-Value Invariants

Preserve these unless the user explicitly changes the direction:

- Core models do not import Zod.
- Core models do not contain runtime logic.
- Player skill storage remains `Record<string, number>`.
- Player level state lives in `player.progression`, not a top-level `level`.
- Players reference skills and weapons by ID only.
- Schemas reject unknown keys via strict objects.
- Registry loaders validate before storing.
- Duplicate content IDs fail fast.
- Experience formula handling stays deterministic and pure.
- No `eval`, runtime scripting, or custom DSL parsing for progression formulas.

## Current Domain Model Summary

Base contracts:

- `Entity`
- `Named`
- `Id`

Data domains:

- player
- progression
- skill
- weapon
- equipment
- inventory
- activity
- npc
- delta
- modifiers

Skill context:

- skills are metadata objects
- players hold levels keyed by skill ID
- tags are freeform strings
- `experience?` and `maxLevel?` are placeholders for future expansion only

## Change Strategy

When modifying the package, use this order:

1. Update core interfaces first if the contract changes.
2. Mirror the contract in the relevant Zod schema.
3. If progression config changes, keep loading schema-backed and JSON-safe.
4. Update example data to match.
5. Expand registry behavior only if runtime lookup needs change.
6. Add or update Jest tests.
7. Run `npm run check`, `npm test`, and `npm run build`.

This order minimizes drift between declared types, validation, and examples.

## When To Add New Files

Add to `src/core/models` when:

- a new domain type is required
- a shared interface is needed

Add to `src/data/schemas` when:

- a new JSON payload needs validation
- a new field requires runtime constraints

Add to `src/data/progression` when:

- a pure progression helper is needed
- a config loading helper is needed
- a constant or formula-adjacent utility is needed without adding state

Add to `src/data/registry` when:

- validated indexed lookup is needed
- duplicate detection matters

Add to `src/data/tests` when:

- a schema rule changes
- a registry behavior changes
- a bug fix needs protection

## Anti-Patterns

Avoid these unless explicitly requested:

- embedding registry objects inside player state
- adding enums for skill tags
- introducing inheritance-heavy model hierarchies
- adding side effects to loaders
- adding formula strings that require interpretation
- using `eval`, `Function`, or any runtime code execution path
- building a custom DSL parser for progression formulas
- placing tests outside the data layer
- mixing save-state contracts with gameplay execution logic

## Good Future Extensions

Likely safe next steps:

- armor or item schemas
- additional registries
- batch validation helpers
- content import pipelines
- content lint rules built on top of the schemas
- extra pure progression helpers that operate on validated config objects
- schema coverage for NPC content if runtime validation becomes necessary
- additional docs and examples that reflect newly exported core modules

Likely unsafe without a deliberate scope change:

- combat resolution
- event buses
- progression systems
- ECS-like behavior layers

## Extending The Formula Safely

If the formula needs to evolve, keep these rules:

- represent new knobs as explicit numeric config fields
- validate them with Zod in the data layer
- keep calculation as plain deterministic TypeScript
- document the formula in technical and user-facing docs
- add direct tests for both valid configs and edge cases

Do not:

- accept arbitrary expressions from JSON
- parse mini-languages for formulas
- move formula behavior into user-provided scripts

## Practical Navigation

Start here when editing:

- public entry: [`src/index.ts`](../src/index.ts)
- core exports: [`src/core/index.ts`](../src/core/index.ts)
- core models: [`src/core/models`](../src/core/models)
- data exports: [`src/data/index.ts`](../src/data/index.ts)
- schemas: [`src/data/schemas`](../src/data/schemas)
- registry: [`src/data/registry/dataRegistry.ts`](../src/data/registry/dataRegistry.ts)
- tests: [`src/data/tests`](../src/data/tests)

## Expected Contributor Behavior

A good agent change in this package should be:

- small in scope
- explicit about assumptions
- validated by tests
- faithful to the separation between contracts and runtime tooling
