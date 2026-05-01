# Angular Development Guide — ProjectGrayVale

> **Applies to:** Codex agents and GitHub Copilot  
> **Angular version:** 21  
> **Last updated:** 2026-05-01

---

## 0. Agent Rules (Read First)

- **Document gaps before implementing.** If a feature touches the core packages (`@rinner/grayvale-core`, `@rinner/grayvale-worldgraph`, `@rinner/grayvale-dialogue`) and you are unsure how to connect UI to that system, stop and describe what you need in a comment block or a `GAP:` note. Do not invent bridge logic without a plan.
- **Never invent data shapes.** All game data comes from static JSON or `.fsc` / `.vf` files from the dialogue package. Do not hardcode values that should come from files.
- **Small components, always.** Every visual piece is its own component. A "smart" component (one that touches a store or service) must not also be the thing rendering pixels. See §3.
- **Do not explain everything in the main UI.** Default to terse labels and compact layouts. If explanatory copy is necessary (for example, what Health, Mana, or Rank means), put it behind a tooltip, hover state, or similar progressive disclosure instead of expanding the base layout.
- **Theme files are the only source of design tokens.** Colors, spacing, typography, and animation durations live in one place. See §4.
- **No inline styles.** No `style=""` attributes, no `[ngStyle]`, no `styleUrls` that duplicate tokens already in the theme.

---

## 1. Project Structure

```
game/
  src/
    app/
      core/                  ← singleton services, guards, interceptors
        services/
        guards/
        store/               ← NgRx root state, root effects
      data/                  ← data loading layer (JSON + dialogue files)
        loaders/
        schemas/             ← Zod re-exports from @rinner/grayvale-core
      shared/                ← pure presentational components, pipes, directives
        components/
        directives/
        pipes/
        theme/               ← SCSS tokens, PrimeNG theme config
      features/              ← one folder per game screen / feature slice
        activity/
        combat/
        companion/
        dialogue/
        inventory/
        quest/
      layout/                ← shell, sidebar, header
    assets/
      data/                  ← static JSON files (activities, items, npcs …)
      dialogue/              ← .fsc / .vf files served statically
    styles/                  ← global SCSS entry point, imports theme/
```

**Rule:** A feature folder owns its own store slice, its own route, and its own smart/dumb component split. It never reaches into another feature's internals directly — it dispatches actions or reads selectors only.

---

## 2. Data Architecture

### 2.1 All Game Data Is Static

The game is **data-driven and read-only at runtime**. There is no backend. Every piece of game content is either:

| Source | Format | Loaded by |
|---|---|---|
| Activity, item, NPC definitions | `.json` in `assets/data/` | `HttpClient` + Zod parse |
| Dialogue scripts | `.fsc` / `.vf` in `assets/dialogue/` | `@rinner/grayvale-dialogue` compile/engine |
| Progression tables | `.json` in `assets/data/progression/` | `HttpClient` + Zod parse |

**Never** import raw JSON via TypeScript `import`. Always load via `HttpClient` so files are served from `assets/` and can be replaced without a rebuild.

```ts
// CORRECT
this.http.get<unknown>('assets/data/activities.json').pipe(
  map(raw => ActivitySchema.array().parse(raw))
)

// WRONG — bakes JSON into the bundle
import activities from '../../assets/data/activities.json';
```

### 2.2 Zod Schemas Come From `@rinner/grayvale-core`

Do not define duplicate interfaces for core entities (Activity, NPC, Item, Delta, Modifier). Import from `@rinner/grayvale-core` and use Zod's `.parse()` at the load boundary. If a type is missing from core, document the gap:

```ts
// GAP: NpcSchema does not yet expose `factionId`. 
// Tracked: needs to be added to @rinner/grayvale-core before this loader can validate faction data.
```

### 2.3 Dialogue Files

Use `@rinner/grayvale-dialogue` to compile and run `.fsc` files. Never attempt to parse `.fsc` manually in game code.

```ts
import { compile, Engine } from '@rinner/grayvale-dialogue';

const script = await firstValueFrom(
  this.http.get('assets/dialogue/intro.fsc', { responseType: 'text' })
);
const tree = compile(script);
const engine = new Engine(tree);
```

The `DialogueComponent` drives the engine. It does not own business logic — it only forwards engine output to the template.

---

## 3. Component Architecture

### 3.1 The Mandatory Split

Every feature has exactly two tiers:

```
feature/
  feature-container.component.ts   ← Smart: reads store, dispatches, injects services
  feature-view.component.ts         ← Dumb: @Input/@Output only, zero store knowledge
  sub-pieces/
    piece-a.component.ts            ← Dumb: single visual responsibility
    piece-b.component.ts
```

A **smart** component must not contain template pixel logic beyond layout glue. A **dumb** component must not inject a store or service (exception: `TranslationService` and theme-only pipes are allowed anywhere).

### 3.2 Component Size Rules

- A component template must not exceed **~80 lines** of HTML. If it does, extract a child component.
- A component class must not exceed **~120 lines** of TypeScript. If it does, move logic to a service or a pure function.
- One component = one file. No inline templates beyond trivial single-element wrappers.

### 3.3 Signals (Angular 21)

Use signal-based reactivity for all new components. Do not use `async` pipe + `Observable` patterns for local state.

```ts
// CORRECT — Angular 21
readonly hp = signal(100);
readonly isDead = computed(() => this.hp() <= 0);

// Acceptable for store observables bridged in the container
readonly activity$ = this.store.select(selectCurrentActivity);
```

Use `toSignal()` to bridge NgRx selectors into the component's signal graph.

### 3.4 Standalone Components

All components are standalone. No `NgModule` declarations. Import only what you use per component.

### 3.5 Progressive Disclosure for UI Copy

- Keep always-visible copy short. Labels, values, and immediate actions come first.
- Put definitions, explanations, and edge-case guidance into tooltips, hover cards, help icons, or expandable detail regions.
- Do not turn core panels into documentation blocks. If the player only needs the explanation occasionally, it should not consume permanent layout space.

---

## 4. Theme and Design Tokens

### 4.1 Central Theme File

All design tokens live in one SCSS file:

```
src/app/shared/theme/_tokens.scss
```

```scss
// _tokens.scss
:root {
  // Colour palette
  --gv-color-bg-primary: #0d0d14;
  --gv-color-bg-surface: #161622;
  --gv-color-bg-raised: #1f1f30;
  --gv-color-accent: #b48aff;
  --gv-color-accent-warm: #ff9a6c;
  --gv-color-text-primary: #e8e8f0;
  --gv-color-text-muted: #7a7a9a;
  --gv-color-danger: #ff5577;
  --gv-color-success: #55cc88;

  // Spacing scale
  --gv-space-xs: 0.25rem;
  --gv-space-sm: 0.5rem;
  --gv-space-md: 1rem;
  --gv-space-lg: 1.5rem;
  --gv-space-xl: 2.5rem;

  // Typography
  --gv-font-ui: 'Inter', system-ui, sans-serif;
  --gv-font-dialogue: 'Lora', Georgia, serif;
  --gv-font-size-sm: 0.8125rem;
  --gv-font-size-md: 1rem;
  --gv-font-size-lg: 1.25rem;
  --gv-font-size-title: 1.75rem;

  // Animation
  --gv-anim-fast: 100ms ease;
  --gv-anim-normal: 200ms ease;
  --gv-anim-slow: 350ms ease;

  // Borders
  --gv-radius-sm: 4px;
  --gv-radius-md: 8px;
  --gv-radius-lg: 16px;
  --gv-border-subtle: 1px solid rgba(255,255,255,0.08);
}
```

**Rule:** No component may define a color, spacing value, or animation duration that is not a CSS variable reference. Adding a new token requires updating `_tokens.scss` first.

### 4.2 PrimeNG Theme Config

Wire tokens into PrimeNG's theme in `src/app/shared/theme/primeng-theme.ts`. Use `definePreset` from `@primeuix/themes`. The theme file is the **only** place PrimeNG surface/primary colors are configured.

```ts
// primeng-theme.ts
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const GrayValeTheme = definePreset(Aura, {
  semantic: {
    primary: { /* map to --gv-color-accent */ },
    surface: { /* map to --gv-color-bg-surface */ },
  }
});
```

---

## 5. Dialogues and Toasts — Multiple Designs

This is one of the most important UI rules in the project.

### 5.1 The Problem

The game has many contextually different dialogues and toasts:
- Story dialogue (dark, serif font, portrait frame)
- System dialogue (confirmation, minimal)
- Combat result dialogue (dramatic, animated)
- Companion affection dialogue (warm palette, soft border)
- Toast: item acquired (brief, bottom-right)
- Toast: level up (prominent, centered, animated)
- Toast: error / warning (danger colors)
- etc.

### 5.2 The Solution: Variant Tokens, Not Duplicate Components

**One structural component per UI primitive.** A single `DialogueComponent` and a single `ToastComponent` handle all variants. Visual differences are expressed via **CSS custom property overrides** scoped to a `data-variant` attribute.

```
shared/
  components/
    dialogue/
      dialogue.component.ts         ← structural logic only (show/hide, engine step)
      dialogue.component.html       ← single template, renders all variants
      dialogue.component.scss       ← reads --gv-dialogue-* tokens
      dialogue.variants.scss        ← defines per-variant token overrides
      dialogue.types.ts             ← DialogueVariant union type
    toast/
      toast.component.ts
      toast.component.html
      toast.component.scss
      toast.variants.scss
      toast.types.ts
```

**`dialogue.types.ts`**
```ts
export type DialogueVariant =
  | 'story'
  | 'system'
  | 'combat-result'
  | 'companion-affection';
```

**`dialogue.variants.scss`**
```scss
[data-variant="story"] {
  --gv-dialogue-bg: var(--gv-color-bg-primary);
  --gv-dialogue-font: var(--gv-font-dialogue);
  --gv-dialogue-border: var(--gv-border-subtle);
  --gv-dialogue-accent: var(--gv-color-text-primary);
}

[data-variant="companion-affection"] {
  --gv-dialogue-bg: #1a1428;
  --gv-dialogue-font: var(--gv-font-dialogue);
  --gv-dialogue-border: 1px solid var(--gv-color-accent);
  --gv-dialogue-accent: var(--gv-color-accent-warm);
}

[data-variant="system"] {
  --gv-dialogue-bg: var(--gv-color-bg-raised);
  --gv-dialogue-font: var(--gv-font-ui);
  --gv-dialogue-border: var(--gv-border-subtle);
  --gv-dialogue-accent: var(--gv-color-text-primary);
}
```

**`dialogue.component.html`**
```html
<div class="gv-dialogue" [attr.data-variant]="variant()">
  <div class="gv-dialogue__portrait" *ngIf="portrait()">
    <img [src]="portrait()" [alt]="speakerName()" />
  </div>
  <div class="gv-dialogue__body">
    <span class="gv-dialogue__speaker">{{ speakerName() }}</span>
    <p class="gv-dialogue__text">{{ currentLine() }}</p>
  </div>
  <gv-dialogue-choices
    *ngIf="choices().length"
    [choices]="choices()"
    (selected)="onChoice($event)"
  />
</div>
```

**Rule:** Adding a new dialogue or toast design means:
1. Adding a value to the `DialogueVariant` / `ToastVariant` union type.
2. Adding a `[data-variant="..."]` block to the `.variants.scss` file.
3. **Never** creating a new component.

### 5.3 When a Variant Is Structurally Different

If a variant needs structural HTML that the base template cannot accommodate (e.g., a fullscreen cinematic dialogue), extract only the structural difference as a sub-component and compose it inside the same base component via `@if (variant() === 'cinematic')`. Still do not create a second top-level dialogue component.

---

## 6. State Management (NgRx)

### 6.1 Structure

```
core/store/
  app.state.ts             ← root AppState interface
  index.ts                 ← provideStore, provideEffects
features/
  activity/
    store/
      activity.actions.ts
      activity.reducer.ts
      activity.selectors.ts
      activity.effects.ts
```

### 6.2 Rules

- Actions are events, not commands. Name them `[Source] Event Happened`, not `DoThing`.
- Effects handle all async work (data loading, dialogue engine ticks). Components never call `HttpClient` directly.
- Selectors are memoized with `createSelector`. No logic in templates beyond signal reads.
- The tick system drives state via dispatched actions, not via direct service calls from components.

### 6.3 Data Loading Pattern

```ts
// activity.effects.ts
loadActivities$ = createEffect(() =>
  this.actions$.pipe(
    ofType(ActivityActions.pageEntered),
    exhaustMap(() =>
      this.http.get<unknown>('assets/data/activities.json').pipe(
        map(raw => ActivitySchema.array().parse(raw)),
        map(activities => ActivityActions.loadSuccess({ activities })),
        catchError(err => of(ActivityActions.loadFailure({ error: err.message })))
      )
    )
  )
);
```

---

## 7. Routing

- Use lazy-loaded routes for each feature. Every feature folder exports a `FEATURE_ROUTES` array.
- Guards live in `core/guards/`. They read from the store, they do not call services directly.
- Route data carries only primitive values or enum keys — never complex objects.

---

## 8. Gap Documentation Protocol

When an agent encounters a requirement that depends on an unresolved system design or missing core package API, it **must** leave a structured gap comment and stop implementing that piece:

```ts
// GAP: [short title]
// Blocked on: @rinner/grayvale-core | @rinner/grayvale-worldgraph | @rinner/grayvale-dialogue | design
// Needs: describe what is missing
// Do not implement until: describe the prerequisite
```

Examples:
```ts
// GAP: Companion affection unlocks
// Blocked on: design
// Needs: defined unlock thresholds for star levels (see 05-companions-and-social-systems.md)
// Do not implement until: AfflictionUnlockSchema is in @rinner/grayvale-core

// GAP: World routing on companion select
// Blocked on: @rinner/grayvale-worldgraph
// Needs: a selector or event that exposes current location nodes
// Do not implement until: WorldGraphService API is finalized
```

This keeps the codebase honest and prevents half-baked bridges that need to be torn out later.

---

## 9. Testing

- Unit tests use Jest. Test files sit next to the file they test: `activity.reducer.spec.ts`.
- E2e tests use Playwright. Scope e2e to flows, not component internals.
- Do not test implementation details. Test state transitions and rendered output.
- Data loaded in tests must come from `examples/` JSON files in `@rinner/grayvale-core`, not from inline test fixtures that duplicate schema shapes.

---

## 10. Quick Reference Checklist

Before opening a PR or marking a task complete:

- [ ] No hardcoded colors or spacing values in component SCSS
- [ ] No `import x from '*.json'` in app source
- [ ] New dialogue/toast design added as a variant, not a new component
- [ ] New game data type uses a Zod schema from `@rinner/grayvale-core`
- [ ] Any blocked implementation has a `GAP:` comment
- [ ] Smart/dumb split respected — no store access in view components
- [ ] Component template under ~80 lines; class under ~120 lines
- [ ] New token added to `_tokens.scss` before use in SCSS


## Rules for Codex Agent

- Always read /systems before writing new specs
- Never overwrite existing structure without reason
- Maintain consistency across files
- Prefer extending over rewriting
- Do not invent mechanics not defined by user
