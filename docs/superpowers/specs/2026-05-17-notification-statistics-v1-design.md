# Notification + Statistics v1 Design (Client-Authoritative)

## Goal
Implement a first production slice that supports declarative notification routing and idempotent statistics ingestion on the client, while preserving future expansion to achievements and server-backed/offline notification flows.

## Scope
Included in v1:
- Atomic gameplay fact ingestion (client-side)
- Idempotent statistics aggregation
- Notification event emission from statistics-driven outcomes
- Declarative notification policy catalog
- Channel routing to toast and system chat (via gameplay log)
- Best-effort server fan-out for combined policies
- Failure observability for fan-out (debug + telemetry counter)

Deferred (prepared but not implemented):
- Achievement rule evaluator execution
- Offline backlog delivery system
- Dedicated chat subsystem
- Server-authoritative stats

## Canonical Domain Decisions
- Notification routing is defined by **Delivery Policy** and **Notification Channel Mapping** per event.
- **Toast** is in-session online UI only.
- **System Chat Message** is the multiplayer-visible text channel for notable events.
- Local notification outcomes are final once shown (**Local Notification Finality**).
- Statistics are built from **Atomic Gameplay Facts**.
- Stats processing is idempotent via deterministic identity keys.

## Architecture

### Data catalogs (static JSON under assets)
1. `game/src/assets/data/notifications/notification-policies.json`
   - Defines per-event routing: delivery policy, channels, audience, toast variant, chat template, fan-out behavior.
2. `game/src/assets/data/progression/statistics-definitions.json`
   - Defines fact types, scopes, and aggregation behavior.
3. `game/src/assets/data/progression/achievement-definitions.json`
   - Added now as preparatory data only (no evaluator in v1).

All catalog data is loaded with `HttpClient` and parsed at boundaries with Zod schemas (from shared/core package when available; otherwise GAP notes required).

### Runtime flow
1. Feature emits `Atomic Gameplay Fact`.
2. Statistics slice ingests fact with deterministic idempotency key.
3. Aggregator updates statistic state if fact is new.
4. Notification event is emitted when policy-relevant conditions occur.
5. Notification orchestrator resolves policy from catalog.
6. Orchestrator dispatches to channels:
   - Toast channel (existing toast pipeline)
   - System chat channel (v1 via gameplay log)
   - Server fan-out channel (best effort)
7. Fan-out failure records debug + telemetry only; no player-facing rollback/warning.

## Code Organization

### New
- `game/src/app/features/statistics/store/`
  - `statistics.actions.ts`
  - `statistics.reducer.ts`
  - `statistics.selectors.ts`
  - `statistics.effects.ts`
  - `statistics-aggregator.ts` (pure utility functions)
- `game/src/app/core/services/notification-policy.service.ts`
- `game/src/app/core/services/notification-orchestrator.service.ts`
- `game/src/app/core/services/notification-server-fanout.service.ts`

### Existing integration points
- `toast-events.service.ts` remains the event entry point for toast channel delivery.
- `toast-watcher.service.ts` remains responsible for toast display/log hooks.
- Gameplay log service acts as v1 system-chat delivery adapter.

## Error Handling and Observability
- Policy lookup miss: debug log + drop event safely.
- Invalid catalog parse: fail-fast on load boundary with explicit error logging.
- Duplicate fact ingestion: ignored by idempotency guard.
- Server fan-out failure: debug log + telemetry counter increment; local UI remains unchanged.

## Testing Strategy

### Unit tests
- Statistics idempotency behavior (duplicate facts do not re-aggregate).
- Aggregation correctness by fact type/scope.
- Notification policy routing matrix (event -> channels/audience/policy).
- Fan-out failure handling (debug + telemetry; no player warning).

### Integration tests
- End-to-end v1 path: fact emitted -> statistic updated -> notification routed -> toast/chat adapters invoked.

## Incremental Delivery Plan
1. Add and validate notification/statistics catalogs.
2. Implement statistics slice + pure idempotent aggregator.
3. Implement notification policy loader service.
4. Implement orchestrator with channel adapters.
5. Wire server fan-out best-effort path + telemetry.
6. Add unit/integration tests for all core paths.
7. Add preparatory achievement definitions catalog (no evaluator execution yet).

## Risks and Mitigations
- Risk: schema drift between catalogs and runtime expectations.
  - Mitigation: strict Zod validation at load boundaries.
- Risk: noisy notification behavior.
  - Mitigation: per-event declarative policy catalog and test matrix.
- Risk: duplicate statistics from retries.
  - Mitigation: deterministic idempotency keys and reducer guards.

## Out of Scope (Explicit)
- Achievement evaluation engine runtime logic.
- Offline notification backlog retrieval/delivery.
- Full chat system implementation.
- Server-authoritative progression ownership.
