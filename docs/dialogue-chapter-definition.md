# Dialogue Chapter Definition

This document describes the **ValeFlow dialogue** chapter shape used in `.fsc` files.

This is **not** the same thing as a story progression chapter in `core`.
A dialogue chapter is an executable script block that the dialogue engine can enter, run, leave, revisit, or jump to with `goto`.

## Minimal Shape

A dialogue chapter starts with a header line and ends when its indented body ends.

```valeflow
chapter START:
    "The story begins here."
```

Structure:

```text
chapter <NAME>:
    <indented statements>
```

## What Can Appear Inside A Chapter

A chapter body can contain:

- narration lines
- speaker lines
- `if / elseif / else`
- `choice`
- `set`
- `call`
- `goto`
- `return`
- nested blocks created by those statements

## Full Example From Start To End

This example shows one complete chapter definition from the chapter header to the last statement in the body.

```valeflow
declare hero = Actor("Lyra")
declare gold = 5
declare hasKey = false

chapter START:
    "A strange door stands at the end of the ruined hall."
    hero "This lock looks older than the city above."

    if hasKey:
        hero "I already have the key."
        goto INNER_GATE
    elseif gold >= 3:
        hero "Maybe I can buy what I need."
        choice:
            "Spend 3 gold on the brass key" -> INNER_GATE
            "Leave the lock alone" -> LEAVE
    else:
        hero "I need another way through."
        goto LEAVE
```

That chapter begins at:

```valeflow
chapter START:
```

and ends at:

```valeflow
        goto LEAVE
```

The chapter is over when the indentation returns to the outer level or a new top-level chapter begins.

## Example With Follow-Up Chapters

Most real scripts use multiple chapters together:

```valeflow
declare hero = Actor("Lyra")
declare gold = 5
declare hasKey = false

chapter START:
    "A strange door stands at the end of the ruined hall."
    hero "This lock looks older than the city above."

    if hasKey:
        goto INNER_GATE
    elseif gold >= 3:
        choice:
            -> "Buy the key":
                set gold = gold - 3
                set hasKey = true
                goto INNER_GATE
            -> "Walk away":
                goto LEAVE
    else:
        goto LEAVE

chapter INNER_GATE:
    hero "The key turns. The gate opens."
    "Cold air spills out from the chamber beyond."

chapter LEAVE:
    hero "Not yet. I need to prepare first."
```

## Authoring Rules

- Use `chapter <NAME>:` for every entry point you want to jump to.
- Keep chapter names stable because `goto` and `call` target them by name.
- Keep the entire body indented consistently.
- End the chapter by ending its indentation, not with a special `end` keyword.
- Put shared setup in top-level `declare` statements before the first chapter.

## Runtime Notes

- Execution begins at the first chapter defined, or in top-level body before any chapter.
- `goto TARGET` clears the current execution stack and jumps into the target chapter.
- The engine tracks visited and completed chapters using canonical keys like `__main__::START`.

## Important Boundary

This document defines only the ValeFlow script shape.
It does not define how a game-level `StoryChapter` in `core` chooses or unlocks a specific `.fsc` dialogue chapter.
