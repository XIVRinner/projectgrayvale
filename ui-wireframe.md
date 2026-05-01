# GrayVale UI Wireframe — v0.6.0

Captured: 2026-05-01. Reflects the live state of the game running at `http://localhost:4200`.

---

## 1. Main Game Screen (Standard Layout)

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  HEADER (game-toolbar)                                                           ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │ PLAYING AS LEVEL 1 HUMAN NADIA                                           │   ║
║  │ @Gray Vale                                                               │   ║
║  │ [Runtime: Browser SPA] [Gameplay log: 16] [👤 Character Selection]      │   ║
║  │ [Nadia · Last save: 2026-05-01 12:20]  [🏆 Achievements] [🖼 Gallery]  │   ║
║  │ [⚙ Settings]  [Hide top bar]                                            │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
╠═══════════════════╦═══════════════════════════════════╦════════════════════════╣
║                   ║                                   ║                        ║
║  LEFT PANEL       ║  MIDDLE STACK                     ║  RIGHT PANEL           ║
║  character-panel  ║  (middle-stack)                   ║  aside-panel           ║
║  [~0.9fr]         ║  [~1.45fr]                        ║  [~0.95fr]             ║
║                   ║                                   ║                        ║
║  ┌─────────────┐  ║  ┌───────────────────────────┐   ║  ┌──────────────────┐  ║
║  │ Nadia       │  ║  │  FEATURE PANEL             │   ║  │ Quest tracker  ∧ │  ║
║  │ Human ·     │  ║  │  (feature-panel)           │   ║  │ ─────────────────│  ║
║  │ Scholar ·   │  ║  │  [1.22fr row height]       │   ║  │ Quest tracker    │  ║
║  │ Type 1      │  ║  │                            │   ║  │         Tracked  │  ║
║  │             │  ║  │  Scene image               │   ║  │         quest    │  ║
║  │  ┌───────┐  │  ║  │  (location artwork)        │   ║  │                  │  ║
║  │  │       │  │  ║  │                            │   ║  │  Nothing tracked │  ║
║  │  │  NPC  │  │  ║  │  ┌─────────────────────┐  │   ║  │                  │  ║
║  │  │  Art  │  │  ║  │  │ NPC PORTRAIT        │  │   ║  │  [Open quest log] │  ║
║  │  │       │  │  ║  │  │ NPC NAME (label)    │  │   ║  └──────────────────┘  ║
║  │  └───────┘  │  ║  │  │ Dialogue line text  │  │   ║                        ║
║  │  LV 1       │  ║  │  └─────────────────────┘  │   ║  ┌──────────────────┐  ║
║  │             │  ║  │  (scrollable transcript)   │   ║  │ Crafting       ∧ │  ║
║  │ ─────────── │  ║  └───────────────────────────┘   ║  │ ─────────────────│  ║
║  │ HEALTH      │  ║                                   ║  │ Nothing being    │  ║
║  │ ████████    │  ║  ┌───────────────────────────┐   ║  │ crafted          │  ║
║  │ 27.2 / 27.2 │  ║  │  ACTION PANEL             │   ║  └──────────────────┘  ║
║  │ "Ready for  │  ║  │  (action-panel)            │   ║                        ║
║  │  travel..." │  ║  │  [0.78fr row height]       │   ║  (more accordions      ║
║  │             │  ║  │                            │   ║   can appear here as   ║
║  │ EXP         │  ║  │  ──── TALK ────            │   ║   game state grows)    ║
║  │ ░░░░░░░░░░  │  ║  │  ▌ What is this place?    │   ║                        ║
║  │ 0 / 200     │  ║  │  ▌ How did you find me?   │   ║                        ║
║  │             │  ║  │  ▌ Where am I in the world?│  ║                        ║
║  │ [Equipment▼]│  ║  │                            │   ║                        ║
║  │ [Purse    ▼]│  ║  │  ──── QUEST ────           │   ║                        ║
║  │ [Attributes▼│  ║  │  ▌ I can stand. Let me try │   ║                        ║
║  │ [Skills   ▼]│  ║  │                            │   ║                        ║
║  │             │  ║  └───────────────────────────┘   ║                        ║
║  └─────────────┘  ║                                   ║                        ║
╠═══════════════════╩═══════════════════════════════════╩════════════════════════╣
║  FOOTER (game-footer-toolbar)                                                    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │ 💡 Tip of the day                                    [Game Wiki] [v0.6.0] │   ║
║  │ "Did you know? If your HP drops to 0, you become     Author: Tear Star    │   ║
║  │  dramatically less alive."                          [GitHub] [🔒 Tear Star]│  ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Command Center Layout (alternate)

When `usesCommandCenterLayout()` is true, the column order and panel placement swap:

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  HEADER (same as standard)                                                       ║
╠════════════════════╦══════════════════════════════╦═════════════════════════════╣
║  LEFT PANEL        ║  MIDDLE STACK                ║  RIGHT PANEL                ║
║  character-panel   ║  aside-panel-inline          ║  feature-panel--side        ║
║  [~0.9fr]          ║  + action-panel [~0.95fr]    ║  [~1.45fr]                  ║
║                    ║                              ║                             ║
║  (same as          ║  ┌────────────────────────┐  ║  ┌───────────────────────┐  ║
║   standard left)   ║  │ Quest tracker + Crafting│  ║  │ Feature Panel content │  ║
║                    ║  │ (inline aside panel)    │  ║  │ (scene image /        │  ║
║                    ║  │                         │  ║  │  stat views / etc.)   │  ║
║                    ║  └────────────────────────┘  ║  └───────────────────────┘  ║
║                    ║  ┌────────────────────────┐  ║                             ║
║                    ║  │ Action Panel            │  ║                             ║
║                    ║  │ (choices remain here)   │  ║                             ║
║                    ║  └────────────────────────┘  ║                             ║
╠════════════════════╩══════════════════════════════╩═════════════════════════════╣
║  FOOTER (same as standard)                                                       ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Panel Breakdown

### 3a. Header (`game-header`)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  [breadcrumb: "PLAYING AS LEVEL 1 HUMAN NADIA"]                                  │
│  Title: @Gray Vale                                                               │
│                                                                                  │
│  [Runtime info]  [Gameplay log btn]  [Character Selection btn]                   │
│  [Character name + last save]  [Achievements]  [Gallery]  [Settings]  [Hide bar] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Buttons in header:**
| Button | Icon | Action |
|---|---|---|
| Gameplay log | counter badge | Opens message log modal |
| Character Selection | person icon | Opens character roster / save manager |
| `Nadia · Last save` | — | Info display (click opens roster) |
| Achievements | trophy | Opens achievements dialog |
| Gallery | image | Opens gallery dialog |
| Settings | gear | Opens settings panel |
| Hide top bar | — | Collapses header (persists via signal) |

---

### 3b. Character Panel (Left) — `character-panel-wrapper`

```
┌──────────────────────────────────┐
│  NAME: Nadia                     │
│  Race · Class · Body Type        │
│  Current Class: Adventurer  [✏] │
│  Title: No title equipped        │
│                                  │
│  ┌──────────────────────────┐   │
│  │     Portrait / Avatar    │   │  ← click → fullscreen modal
│  │         LV 1             │   │
│  └──────────────────────────┘   │
│                                  │
│  HEALTH         27.2 / 27.2     │
│  [████████████████████████]     │
│  "Ready for travel, work, or    │
│   combat"                        │
│                                  │
│  EXP                  0 / 200   │
│  [░░░░░░░░░░░░░░░░░░░░░░░░]     │
│  Total EXP 0   Next level @ 200 │
│                                  │
│  ▾ Equipment ─────────────────  │  ← collapsible accordion
│  ▾ Purse ─────────────────────  │
│  ▾ Attributes ─────────────────  │  ← active by default (expanded)
│  ▾ Skills ─────────────────────  │
│  ▾ Companions ─────────────────  │  (if available)
└──────────────────────────────────┘
```

**Attributes accordion (expanded example):**
```
  Strength  ████░░░░░░  4
  Agility   ████░░░░░░  4
  Vitality  ████░░░░░░  4
  Intellect ████░░░░░░  4
  Arcana    ████░░░░░░  4
  Medicine  ████░░░░░░  4
  ...
  [Unspent attribute points: 4]
```

---

### 3c. Feature Panel (Centre Top)

Context-sensitive — driven by current game state / NPC / location. Contains:

| State | Content |
|---|---|
| **Prologue / Dialogue** | Scene artwork (location image) + scrollable dialogue transcript with NPC portraits |
| **Statistics** | Stat charts, level progress |
| **Dungeon** | Dungeon map / combat view |
| **Shop / Blacksmith** | Item grid, buy/sell UI |
| **Inventory** | Equipment slots + item grid |
| **Crafting** | Recipe list + materials |
| **Party / Raid** | Party roster + formation |
| **Relationships** | NPC relationship meters |

**Dialogue transcript (Prologue state):**
```
┌────────────────────────────────────────────────────────┐
│  [Scene image: forest / shelter / location artwork]    │
│                                                        │
│  ┌──────┐  VILLAGE CHIEF                               │
│  │ NPC  │  "We found you, Human, at the edge of the   │
│  │ art  │   forest. Unconscious, bruised from head    │
│  └──────┘   to heel..."                               │
│                                                        │
│  ┌──────┐  NPC NAME                                   │
│  │ NPC  │  "Next line of dialogue text..."            │
│  │ art  │                                             │
│  └──────┘                                             │
└────────────────────────────────────────────────────────┘
```

---

### 3d. Action Panel (Centre Bottom)

```
┌────────────────────────────────────────────────────────┐
│  ──────────────────── TALK ─────────────────────────  │
│  ▌ What is this place?                               │
│  ▌ How did you find me?                              │
│  ▌ Where am I in the world?                          │
│                                                      │
│  ──────────────────── QUEST ────────────────────────  │
│  ▌ I can stand. Let me try.                          │
│                                                      │
│  (other groups: COMBAT, TRAVEL, CRAFT, TRADE, etc.)  │
└────────────────────────────────────────────────────────┘
```

Action groups are colour-coded by category (Talk = purple, Quest = green, Combat = red, etc.).

---

### 3e. Aside Panel (Right) — `aside-panel-wrapper`

```
┌──────────────────────────────┐
│  Quest tracker            ∧  │  ← collapsible
│  ──────────────────────────  │
│  Quest tracker   Tracked quest│
│                               │
│  Nothing is being tracked     │
│  right now.                   │
│                               │
│  [Open quest log]            │
└──────────────────────────────┘

┌──────────────────────────────┐
│  Crafting                 ∧  │  ← collapsible
│  ──────────────────────────  │
│  Nothing is currently being  │
│  crafted.                    │
└──────────────────────────────┘
```

---

### 3f. Footer (`game-footer`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  💡 Tip of the day                                                           │
│  "Did you know? If your HP drops to 0, you become dramatically less alive."  │
│                                                                              │
│                                  [Game Wiki]  [v0.6.0]  Author: Tear Star   │
│                                              [GitHub 🔗]  [🔒 Tear Star]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Dialogs / Modals

### 4a. Character Roster / Save Manager

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHARACTER ROSTER                                          [✕ close]         │
│  ──────────────────────────────────────────────────────────────────────────  │
│  Persistent roster — Save slots                                              │
│  [Export all]  [Import all]  [Reset all saves]                               │
│                                                                              │
│  ┌──────────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │  SAVE SLOTS                          │  │  LOAD CHARACTER              │ │
│  │                                      │  │  ┌──────┐  Nadia             │ │
│  │  Slot 1 [Active] [Export] [Delete]   │  │  │ art  │  Scholar · Human   │ │
│  │  ┌──────┐  Nadia  Scholar  Human     │  │  │      │  Type 1 · Level 1  │ │
│  │  │ art  │  Type 1  Lv.1  Normal     │  │  └──────┘  Normal             │ │
│  │  └──────┘  Location: Prologue       │  │            Location: Prologue  │ │
│  │            Created in: 0.6.0        │  │  [Load slot]                  │ │
│  │                                      │  └──────────────────────────────┘ │
│  │  Slot 2  [+ Empty slot]              │  ┌──────────────────────────────┐ │
│  │  Slot 3  [+ Empty slot]              │  │  TRANSFER  (Import/Export)   │ │
│  │  [+ Add slot]                        │  │  Paste JSON here to move     │ │
│  └──────────────────────────────────────┘  │  saves between machines.     │ │
│                                            │  [textarea]                  │ │
│  CREATE NEW CHARACTER panel               │  [Import JSON] [Export JSON] │ │
│  ┌──────────────────────────────────────┐  └──────────────────────────────┘ │
│  │  Race selection: Human | Elf | ...   │                                    │
│  │  Body type: Type 1 | Type 2 | Type 3 │                                    │
│  │  Class / name, etc.                  │                                    │
│  └──────────────────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4b. Achievements Dialog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Achievements                                              [✕ close]         │
│  Achievement Points: 0                                                       │
│  ──────────────────────────────────────────────────────────────────────────  │
│  ┌────────────────────────┐  ┌─────────────────────────────────────────┐    │
│  │  CATEGORIES (sidebar)  │  │  EARNED IN CATEGORY                     │    │
│  │                        │  │  ┌──────┐  Skilled Hands  [Locked] +30  │    │
│  │  Combat         +      │  │  │ art  │  "Reach 100 total skill pts"  │    │
│  │  Crafting       +      │  │  └──────┘                               │    │
│  │  Economy        +      │  │  ┌──────┐  You Can Feel It  [Locked]+10 │    │
│  │  Exploration    +      │  │  │ art  │  "Learn Arcana Sense"         │    │
│  │  Progression    -      │  │  └──────┘                               │    │
│  │    All                 │  └─────────────────────────────────────────┘    │
│  │    Attributes          │  ┌─────────────────────────────────────────┐    │
│  │    Level Milestones    │  │  ACHIEVEMENT (detail panel)             │    │
│  │    Quests              │  │  [Achievement art]                      │    │
│  │  ● Skills              │  │  Value: 30                              │    │
│  │  Relationships  +      │  │  Reward: Achievement points awarded     │    │
│  │  Tavern         +      │  │  How to earn: Reach 100 skill points    │    │
│  └────────────────────────┘  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4c. Game Wiki Dialog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GAME WIKI               [Game Help] [Compendium] [Gallery ●] [Novel]  [✕]  │
│  REFERENCE                                                                   │
│  Game Wiki                                                                   │
│  ──────────────────────────────────────────────────────────────────────────  │
│  ┌────────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐  │
│  │  CATEGORIES        │  │  Gallery thumbnail grid │  │  DETAIL PANEL    │  │
│  │  ┌─────────────┐   │  │  ┌──────┐  ┌──────┐    │  │  PLAYER          │  │
│  │  │  search box │   │  │  │ img  │  │ img  │    │  │  [Available]     │  │
│  │  └─────────────┘   │  │  │ P.01 │  │ P.02 │    │  │                  │  │
│  │                    │  │  └──────┘  └──────┘    │  │  [portrait img]  │  │
│  │  Named NPCs  >     │  │  ┌──────┐  ┌──────┐    │  │                  │  │
│  │  Locations   >     │  │  │ img  │  │ img  │    │  │  HUMAN           │  │
│  │                    │  │  │ P.03 │  │ P.04 │    │  │  PORTRAIT        │  │
│  │                    │  │  └──────┘  └──────┘    │  │  SFW             │  │
│  └────────────────────┘  └─────────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4d. Content Choice Modal (first load)

```
┌─────────────────────────────────────────────────────┐
│  CONTENT CHOICE                                      │
│  Choose your content mode                            │
│                                                      │
│  Pick whether this playthrough should use SFW-only   │
│  content or allow NSFW content.                      │
│  You can change this later in settings.              │
│                                                      │
│              [Use SFW only]   [Enable NSFW]          │
└─────────────────────────────────────────────────────┘
```

### 4e. Death Penalty Widget (draggable overlay)

```
┌──────────────────────────────────┐
│  ☠ Death Penalty  [00:30]  (drag)│
│  ──────────────────────────────  │
│  You can still move between      │
│  zones.                          │
│  All other activities are locked │
│  until the timer ends.           │
└──────────────────────────────────┘
```

---

## 5. CSS Grid Dimensions (reference)

```
Outer layout (game-layout):
  grid-template-rows: auto  [header]
                      1fr   [content-grid]
                      auto  [footer]

Content grid (content-grid):
  grid-template-columns: minmax(250px, 0.9fr)   [character-panel]
                         minmax(0, 1.45fr)       [middle-stack]
                         minmax(260px, 0.95fr)   [aside-panel]

Middle stack (middle-stack):
  grid-template-rows: minmax(0, 1.22fr)   [feature-panel]
                      minmax(0, 0.78fr)   [action-panel]

Command Center variant swaps columns 2 & 3:
  grid-template-columns: 0.9fr  0.95fr  1.45fr
```

---

## 6. Colour Palette (key tokens)

| Role | Value |
|---|---|
| Background | `#08101c` |
| Panel background | `rgba(9, 16, 31, 0.82)` |
| Panel border | `rgba(255,255,255,0.08)` |
| Panel shadow | `0 18px 45px rgba(0,0,0,0.25)` |
| Health bar | Orange (`#e07c2a` approx.) |
| EXP bar | Yellow-orange |
| Action: Talk | Purple / violet accent |
| Action: Quest | Green accent |
| Gold / highlight | `~#c89b3c` (Achievements, NSFW button) |
| Text (primary) | White / near-white |
| Text (muted) | `rgba(255,255,255,0.4)` |

---

*Generated from live app screenshots — see `docs/` for supporting assets.*
