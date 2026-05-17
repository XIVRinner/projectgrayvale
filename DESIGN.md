---
name: ProjectGrayVale
description: Arcane, precise, dependable RPG server and game-shell UI.
colors:
  void-navy: "#050a12"
  deep-surface: "#08111d"
  raised-navy: "#0b1220"
  ward-blue: "#102036"
  text-star: "#f5f7ff"
  parchment-muted: "#f5f1e8"
  relic-gold: "#ffc145"
  warm-gold: "#ffd88c"
  relay-teal: "#5bc0be"
  ritual-violet: "#a78bfa"
  success-herb: "#8dd8a7"
  danger-ember: "#ff8e7e"
typography:
  display:
    fontFamily: "Cinzel, Palatino Linotype, Book Antiqua, Palatino, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Bahnschrift, Aptos, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Bahnschrift, Aptos, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Bahnschrift, Aptos, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "20px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  panel:
    backgroundColor: "{colors.deep-surface}"
    textColor: "{colors.text-star}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  button-primary:
    backgroundColor: "{colors.void-navy}"
    textColor: "{colors.text-star}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  field:
    backgroundColor: "{colors.void-navy}"
    textColor: "{colors.text-star}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
---

# Design System: ProjectGrayVale

## 1. Overview

**Creative North Star: "The Reliquary Console"**

GrayVale’s UI is a dependable control surface inside an arcane fantasy world. It uses dark relic-metal surfaces, warm gold emphasis, and precise teal server signals to make play, identity, chat, and moderation workflows feel deliberate rather than ornamental.

The system is product-first. Panels, dialogs, forms, and server confirmations should be compact, readable, and trustworthy. Atmosphere is welcome only when it improves orientation or reinforces consequence.

It explicitly rejects neon cyberpunk MMO noise, excessive glow, unreadable fantasy chrome, and decorative effects that make server/admin workflows feel less reliable.

**Key Characteristics:**
- Dark navy layered surfaces with restrained gold and teal signals.
- Compact product layouts, not poster-like fantasy scenes.
- Clear consent points for server state, character identity, and admin actions.
- Ritual atmosphere through typography, labels, and tonal depth, not visual clutter.

## 2. Colors

The palette is a restrained relic-metal system: near-black navy surfaces, parchment-tinted text, relic gold for importance, and relay teal for server-connected state.

### Primary
- **Relic Gold**: The primary action and emphasis color. Use sparingly for key headings, current focus, and high-value calls to action.
- **Relay Teal**: The server and communication signal. Use for connected states, server identity, save/profile interaction, and network-adjacent affordances.

### Secondary
- **Ritual Violet**: Reserved for arcane/story/system accents, special states, and rare classification.
- **Warm Gold**: Softer support for companion, reward, or highlighted-but-not-primary emphasis.

### Tertiary
- **Success Herb**: Success and safe-completion states.
- **Danger Ember**: Error, destructive, warning, and moderation consequence states.

### Neutral
- **Void Navy**: Main app background and form field base.
- **Deep Surface**: Primary shell and dialog surface.
- **Raised Navy**: Nested panels, inputs, and secondary blocks.
- **Ward Blue**: Stronger tonal layer for structured boundaries.
- **Text Star**: Primary readable text.
- **Parchment Muted**: Secondary text, copy, helper labels, and less important metadata.

### Named Rules

**The Signal Rarity Rule.** Gold and teal are signals, not decoration. If more than one thing on a screen looks primary, the screen is wrong.

**The No Neon Rule.** Saturated glows are prohibited. Server state can feel magical, but it must never read as cyberpunk or arcade.

## 3. Typography

**Display Font:** Cinzel with Palatino-family fallbacks.
**Body Font:** Bahnschrift with Aptos, Segoe UI, and sans-serif fallbacks.
**Label/Mono Font:** Use the body stack for labels. Use monospace only for UUIDs, tokens, and debug-like values.

**Character:** Display typography supplies the ritual note. Product typography does the work: compact, technical enough to scan, and familiar enough to trust.

### Hierarchy
- **Display** (700, title scale, tight line-height): Dialog titles, special headings, and story-adjacent surfaces only.
- **Headline** (700, large UI scale): Major panel headings and shell titles.
- **Title** (600-700, medium UI scale): Section headings, list titles, and compact cards.
- **Body** (400, standard UI scale): Player-facing copy, server status text, and help copy. Cap prose at 65-75ch.
- **Label** (600, small scale, wide tracking, uppercase when useful): Form labels, eyebrows, status labels, and compact metadata.

### Named Rules

**The Ritual Header Rule.** Serif display type is for ceremony and hierarchy. It is forbidden for routine field labels, buttons, tables, or dense admin controls.

## 4. Elevation

GrayVale uses tonal layering first and shadow second. Surfaces feel stacked through navy values, borders, subtle overlays, and occasional large ambient shadows on shell panels or dialogs. Shadows should feel like depth in a dark room, not glossy floating cards.

### Shadow Vocabulary
- **Shell Ambient** (`0 18px 42px var(--gv-color-bg-primary)`): Top-level app panels and the topbar.
- **Dialog Depth** (`0 30px 80px color-mix(in srgb, var(--gv-color-bg-primary) 88%, transparent)`): Modal/dialog shells that must separate from the game surface.
- **Dialogue Depth** (`0 2rem 5rem color-mix(in srgb, var(--gv-color-bg-primary) 92%, transparent)`): Story and special dialogue surfaces.

### Named Rules

**The Tonal First Rule.** If depth can be expressed with surface color, border, and spacing, do not add a new shadow.

## 5. Components

### Buttons
- **Shape:** Compact, slightly rounded controls (6px to 20px depending on scope). Icon/pill actions may use full rounding.
- **Primary:** Dark or tinted surface with text-star foreground, gold or teal border change on hover/focus.
- **Hover / Focus:** Use border-color, background tint, and small translate motion. Do not animate layout properties.
- **Secondary / Ghost:** Overlay-soft backgrounds and subtle borders. They must still look clickable.

### Chips
- **Style:** Small uppercase or compact inline tokens with tinted backgrounds, currentColor borders, and semantic colors.
- **State:** Use text plus color. Custom content, official, success, warning, and destructive states need readable labels, not color alone.

### Cards / Containers
- **Corner Style:** Rounded panels (12px to 20px) with subtle borders.
- **Background:** Deep Surface for main panels, Raised Navy for nested panels, Void Navy for fields.
- **Shadow Strategy:** Shell and dialog containers may use ambient depth. Nested cards should rely on tonal contrast.
- **Border:** Use `--gv-border-subtle` unless a real state needs a stronger border.
- **Internal Padding:** Default to 1rem. Increase only for major dialogs or empty states.

### Inputs / Fields
- **Style:** Void Navy background, subtle border, small radius, compact padding.
- **Focus:** Border shift toward teal or gold with visible focus. Never remove focus indication.
- **Error / Disabled:** Error states use Danger Ember plus text. Disabled states lower opacity and retain readable labels.

### Navigation
- **Style:** Dense shell navigation and topbar controls with clear active/hover states.
- **Typography:** UI sans, compact labels, strong enough weight for scanning.
- **Mobile Treatment:** Collapse structural columns into a single column before content becomes cramped.

### Dialog Shell
- **Character:** The canonical confirmation and system surface. Use it for server consent, character registration, save management, and admin prompts.
- **Structure:** Eyebrow, title, short subtitle, then task panels. Keep explanatory text brief and push details into secondary hints.

## 6. Do's and Don'ts

### Do:
- **Do** make server state explicit before join, switch, registration, or reconnect actions.
- **Do** use Relic Gold for importance and Relay Teal for server/network state.
- **Do** keep admin and moderation tools sober, compact, and consequence-aware.
- **Do** use compact progressive disclosure for complex server and identity explanations.
- **Do** respect WCAG AA where practical: visible focus, keyboard-usable dialogs/forms, reduced motion, and non-color state cues.

### Don't:
- **Don't** create neon cyberpunk MMO noise, excessive glow, or unreadable fantasy chrome.
- **Don't** use fantasy styling that obscures controls, labels, UUIDs, passwords, or moderation consequences.
- **Don't** make server entry, character registration, or reconnect behavior silent or automatic when consent is required.
- **Don't** use side-stripe borders greater than 1px as a decorative accent on cards, list items, callouts, or alerts.
- **Don't** use gradient text or decorative glassmorphism as default UI treatment.
