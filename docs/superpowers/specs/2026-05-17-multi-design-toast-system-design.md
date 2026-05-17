# Multi-design Toast System Design (PrimeNG-backed)

Date: 2026-05-17  
Project: ProjectGrayVale  
Register: product

## Goal
Create a robust, typed, multi-variant toast system using PrimeNG as the rendering layer, with explicit variant-driven defaults for placement and timeout, queueing behavior, and flood protection.

## Scope
In scope:
- PrimeNG-backed toast rendering
- Typed facade service for all toast creation
- Variant config map (position, timeout, style variant)
- One active toast per position, queued overflow
- Queue caps per position (flood guard)
- Variant-driven design tokens
- Unit/integration tests

Out of scope:
- Sticky toasts
- Caller-defined position overrides by default
- Replacing PrimeNG with custom renderer

## Requirements
1. Toasts are created through a dedicated app service, not direct feature calls to PrimeNG MessageService.
2. Each toast variant has explicit defaults:
   - default position
   - life timeout
   - visual variant key
3. Concurrent behavior:
   - one active toast per position
   - overflow queued per position
4. Auto-expire only, no sticky toasts.
5. Queue cap per position to guard against flooding.
6. Support multiple positions at once (for example top-right and bottom-center).
7. Styling must use centralized tokens and variant overrides.

## Architecture

### 1) Rendering layer
- Use PrimeNG `<p-toast>` outlets in shell-level UI.
- One outlet per supported position.
- PrimeNG remains the visual/a11y/runtime base.

### 2) Domain/facade layer
Create `GrayvaleToastService` (name can be finalized in implementation) responsible for:
- accepting typed toast requests
- resolving variant config
- queueing and lifecycle per position
- forwarding active toast messages to PrimeNG MessageService

Feature code calls this service only.

### 3) Configuration layer
Single source-of-truth config map:
- `ToastVariant -> ToastVariantConfig`
- Config fields:
  - `position`
  - `lifeMs`
  - `severity` (if needed for PrimeNG semantics)
  - `icon` (optional)
  - `styleVariant` (or direct variant id)

All variants default to non-sticky behavior.

## Data model and API

### Variant types
Initial union (expandable):
- `level-up`
- `friend-request`
- `guild-invite`
- `skill-unlock`
- `attribute-unlock`
- `game-updated`
- `achievement-earned`

### Position types
Supported explicit positions (initial):
- `top-right`
- `bottom-center`

### Public service API
- `show(variant: ToastVariant, payload: ToastPayload): void`
- Optional convenience wrappers per variant:
  - `showLevelUp(payload)`
  - `showFriendRequest(payload)`
  - etc.

`ToastPayload` core:
- `title`
- `message`
- optional metadata for future richer rendering

## Queue and lifecycle design
For each position keep:
- `active: ToastInstance | null`
- `queue: ToastInstance[]`

Flow:
1. `show(...)` resolves config and instance.
2. If no `active`, display immediately and mark active.
3. If active exists, enqueue.
4. On expire/close of active:
   - clear active
   - dequeue next if present and display

### Flood guard
- Add `maxQueuePerPosition` cap.
- On overflow, drop by explicit policy (recommended: drop oldest queued item) and log/debug-signal.
- Cap is configurable constant in toast domain.

## Styling and tokens
Follow existing project rules:
- No inline styles
- No ad-hoc hardcoded component colors/spacing
- Variant-based styling via class/attribute hooks and token overrides

Planned structure:
- Base toast styles consume shared tokens.
- Variant-specific overrides keyed by variant identifier.
- Position is structural (PrimeNG outlet placement), variant controls look/feel.

## Testing plan

### Unit tests (service)
- variant config resolution correctness
- immediate display when slot free
- enqueue when slot occupied
- dequeue on expire/close
- per-position independence
- queue cap enforcement and drop policy

### Integration tests (with mocked MessageService)
- verify add/clear flow for lifecycle transitions
- verify correct outlet/position keying and timing behavior assumptions

### Optional component-level test
- shell has required `<p-toast>` outlets for supported positions

## Error handling and resilience
- Unknown variant should be compile-time prevented via union typing.
- Runtime fallback (defensive): safe no-op + warning in dev if invalid key appears.
- Queue overflow handled deterministically by cap policy.

## Accessibility and UX notes
- Keep concise copy in visible toast text.
- Respect reduced motion for toast transitions.
- Preserve keyboard and screen-reader behavior from PrimeNG defaults.

## Rollout plan
1. Add variant types and config map.
2. Implement facade service and queue manager.
3. Wire shell-level PrimeNG outlets per position.
4. Add variant token styles.
5. Add tests.
6. Replace any future direct MessageService usages with facade-only pattern.

## Open decisions resolved
- PrimeNG chosen as renderer.
- Variant decides position explicitly.
- One active toast per position.
- Overflow is queued.
- All toasts auto-expire.
- Queue caps enabled for flood protection.
