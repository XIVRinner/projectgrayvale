# GAPs

This document tracks deferred systems and blocked concepts that must not be improvised in code.

## Full Arkama Route Expansion

- Blocked on: scope
- Needs: approved node list, edges, guard rules, and presentation metadata beyond `village-arkama` and `camp`
- Do not implement until: the minimal world foundation is stable and the next route slice is specified
- Affected files/systems: `game/src/assets/data/world-graph.json`, `game/src/assets/data/world-locations.json`, world navigation UI

## ValeFlow Prologue Integration

- Blocked on: world-first implementation order
- Needs: the wake-up dialogue, actor metadata, and button-to-dialogue bridge inside `chief-house`
- Do not implement until: world state, sublocations, and mandatory button deltas are live in the shell
- Affected files/systems: `@rinner/grayvale-dialogue`, prologue assets, game dialog UI

## Combat And Activity Popup Modes

- Blocked on: design
- Needs: concrete payload contracts and renderer behavior for combat and activity popup content
- Do not implement until: the popup mode schemas are defined
- Affected files/systems: shared dialog shell, future game-dialog components

## Activity Runtime And Recover Loop

- Blocked on: design
- Needs: authored runtime rules for activity start, ticking, reward/stat deltas, and stop conditions
- Do not implement until: the activity executor contract exists
- Affected files/systems: activities feature, recover flow, core activity integration

## Additional Route Gate Families Beyond Base Progression Gates

- Blocked on: design
- Needs: authored rules for non-progression gates such as faction, items, companions, events, time, or temporary world conditions
- Do not implement until: those systems expose stable state contracts and approved guard semantics
- Affected files/systems: `game/src/assets/data/world-guards.json`, world guard evaluator, future route metadata

## Chief House Repeat Narrative Handling

- Blocked on: story design
- Needs: a decision on what repeat dialogue or interactions should happen when the player re-enters `chief-house`
- Do not implement until: the chief-house revisit narrative behavior is specified
- Affected files/systems: future dialogue actions, village navigation, prologue follow-up content
