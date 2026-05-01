# Story Chapter Definition

This document describes the **story progression** chapter shape used by `core/src/core/story`.

This is **not** the same thing as a ValeFlow dialogue `chapter`.
A story chapter is metadata that tells the game what chapter the player is in.
The dialogue package uses separate script chapters for line-by-line narrative flow.

## Source of Truth

The current shape comes from `core/src/core/story/story.types.ts`:

```ts
export interface StoryChapter {
  number: number;
  title: string;
  subcaption?: string;
  styleDefinition?: string;
  isPrologue?: boolean;
}

export interface StoryArc {
  id: string;
  title: string;
  subtitle?: string;
  styleDefinition?: string;
  chapters: Record<number, StoryChapter>;
}
```

## What A Full Chapter Definition Looks Like

A chapter only exists inside a `StoryArc`.
The authored structure starts at the arc and ends at the chapter entry.

```ts
import type { StoryArc } from "../core/src/core/story";

export const mainArc: StoryArc = {
  id: "arc_main",
  title: "Main Arc",
  subtitle: "The Gray Vale Opens",
  styleDefinition: "main-story",
  chapters: {
    1: {
      number: 1,
      title: "Arrival",
      subcaption: "The first steps into the vale.",
      styleDefinition: "prologue-cold-open",
      isPrologue: true
    },
    2: {
      number: 2,
      title: "First Oath",
      subcaption: "A promise that binds the party."
    },
    3: {
      number: 3,
      title: "Ash in the Road"
    }
  }
};
```

## Field Meaning

- `number`: The numeric story chapter identifier within the arc.
- `title`: The player-facing chapter title.
- `subcaption`: Optional subtitle or chapter strapline.
- `styleDefinition`: Optional presentation key for chapter-intro UI.
- `isPrologue`: Optional flag for special prologue treatment.

## Authoring Rules

- Put chapters inside a single `StoryArc.chapters` record keyed by chapter number.
- Keep the record key and `chapter.number` aligned.
- Treat the story chapter as declarative metadata, not executable logic.
- Use `styleDefinition` only as a style key, not as a carrier for mechanics.
- Do not embed dialogue lines, rewards, combat data, or quest logic directly in this object.

## Runtime State Shape

The runtime-facing story state is separate from authored chapter metadata:

```ts
export interface StoryState {
  currentArcId: string;
  currentChapter: number;
  completedChapters?: number[];
}
```

Example:

```ts
const storyState = {
  currentArcId: "arc_main",
  currentChapter: 2,
  completedChapters: [1]
};
```

This means:

- the player is currently in chapter `2`
- chapter `1` has already been completed

## End-To-End Example

This is the smallest useful story chapter setup from authored data through active state:

```ts
const arc: StoryArc = {
  id: "arc_main",
  title: "Main Arc",
  chapters: {
    1: {
      number: 1,
      title: "Arrival",
      isPrologue: true
    },
    2: {
      number: 2,
      title: "First Oath"
    }
  }
};

const state = {
  currentArcId: "arc_main",
  currentChapter: 1,
  completedChapters: []
};
```

At that point:

- `Arrival` is the active story chapter
- `First Oath` exists as the next authored chapter
- progression logic can later move `currentChapter` forward


