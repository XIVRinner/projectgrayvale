---
name: legacy-vale
description: "Salvage code, logic, or patterns from the legacy ProjectGrayVale project (oldgame/). Use when: porting old features, recovering game logic, adapting old components, finding how something was previously implemented, migrating stores or services. Triggers: 'salvage from legacy', 'port from oldgame', 'legacy-vale', 'how did we do X before', 'recover old code'."
argument-hint: "what to salvage (e.g. combat logic, companion store, dialogue flow)"
---

# Legacy Vale — Salvage Skill

Guides the agent through finding and adapting code from the legacy `oldgame/` project to the current `game/` architecture.

## When to Use

- Porting a feature that existed in the old project (combat, companions, inventory, dialogue, etc.)
- Recovering business logic, formulas, or data-processing code that should not be rewritten from scratch
- Finding how a system was previously structured before adapting it to the new standards
- Locating old assets, data files, or documentation that pre-date the current project

---

## Legacy Project Map

```
oldgame/
  src/app/
    core/
      config/          ← game config constants
      formatting/      ← number/text formatters
      i18n/            ← translation keys and locale files
      runtime/         ← game tick / loop logic
      save/            ← save/load system
      settings/        ← player settings
      store/           ← NgRx root store (old patterns)
    features/
      game/
        application/   ← app-level orchestration
        data/          ← old data loaders (may use direct JSON imports — do NOT copy as-is)
        domain/        ← pure domain logic (most salvageable)
        ui/            ← old components (use only for layout reference)
    shared/            ← old shared components, pipes, directives
  public/
    data/              ← old static JSON files (compare shapes with current assets/)
    asset/             ← old images/icons
    i18n/              ← old translation JSON
  docs/                ← old architecture notes and changelogs
```

---

## Procedure

### 1. Locate the Target

Search `oldgame/` for the relevant code before reading anything:

```
grep_search or file_search inside oldgame/src/
```

Key places by salvage type:

| What you need | Where to look first |
|---|---|
| Game formulas / stat math | `oldgame/src/app/features/game/domain/` |
| Old store slices | `oldgame/src/app/features/game/application/` or `oldgame/src/app/core/store/` |
| Old data shapes | `oldgame/public/data/*.json` → compare with `core/examples/*.json` |
| Old components (layout reference) | `oldgame/src/app/features/game/ui/` |
| Old services | `oldgame/src/app/core/runtime/` or `oldgame/src/app/features/game/application/` |
| Tick / loop logic | `oldgame/src/app/core/runtime/` |
| Translation keys | `oldgame/public/i18n/` |
| Old docs / design notes | `oldgame/docs/` |

### 2. Assess Before Copying

For every file you intend to salvage, check:

- [ ] Does it import raw JSON via `import x from '*.json'`? → Must be converted to `HttpClient` load
- [ ] Does it use `NgModule`? → Must be converted to standalone component
- [ ] Does it use `async` pipe + Observable for local state? → Convert to signals (`signal`, `computed`, `toSignal`)
- [ ] Does it reference old store action shapes (imperative commands)? → Rename to event-style `[Source] Event Happened`
- [ ] Does it define its own color or spacing values? → Replace with tokens from `_tokens.scss`
- [ ] Does it duplicate a Zod schema already in `@rinner/grayvale-core`? → Use the core schema instead

### 3. Adapt to Current Standards

Follow the rules in `agents.md` when porting:

- **Smart/dumb split** — if the old component is monolithic, split it
- **Signal-based reactivity** — replace local Observables with signals
- **HttpClient + Zod at load boundary** — never bundle JSON
- **Variant system for UI** — if porting a dialogue/toast variant, add to `.variants.scss`, not a new component
- **GAP comments** — if the old code depends on an API that doesn't exist yet in core packages, leave a `GAP:` comment and stop

### 4. Cross-Reference Old Data

Old data files in `oldgame/public/data/` may differ from the canonical schemas in `@rinner/grayvale-core`. Always reconcile against:

- `core/examples/*.json` — canonical data shapes
- `core/src/` — Zod schema definitions

If the old data has fields the new schema doesn't, document a `GAP:` — do not invent new schema fields.

### 5. Old Docs as Context Only

Files in `oldgame/docs/` are historical context. They describe how things *were*, not how they *should be*. Read them for intent and formulas, not for architecture decisions.

---

## What NOT to Salvage

- **Electron shell** (`oldgame/electron/`) — the new project is web-only
- **Old proxy config** (`oldgame/proxy.conf.json`) — no backend
- **Old NgModule declarations** — the new project is fully standalone
- **Old SCSS with hardcoded hex values** — always replace with `_tokens.scss` variables
- **Old direct JSON imports** — always replace with `HttpClient` + Zod

---

## Output Expectations

After salvaging, the ported code should:

1. Pass `get_errors` with no TypeScript errors
2. Respect the smart/dumb component split
3. Use only CSS variable references from `_tokens.scss` for styling
4. Have no `import x from '*.json'` in app source
5. Include `GAP:` comments for anything that couldn't be fully resolved
