# NPC Baseline

## Purpose & Change Rules
- This document is the authoritative source for static companion identity fields and world-anchor semantics.
- Companion profiles must align with this baseline.
- Baseline edits require explicit approval before writing.

## Core Static Fields
- companion_name
- companion_type (combat | non-combat)
- race
- primary_role
- secondary_role (optional)
- identity_tags
- first_meet_context
- questline_hook
- personality_social_tags

## Character Naming Canon
- `companion_name` is mandatory in every companion profile.
- Name format uses a player-facing **Title Case** display name.
- Optional internal `name_key` may be used in `snake_case` for references.
- Companion display names must be unique across the companion roster.
- If a name includes an honorific/title (for example, `Saint ...`), store the full display form in `companion_name`.

## World Anchor Registry

### format-example
- region:
  - key:
  - status:
  - locations:
    - key:
      - status:
      - sublocations:
        - key:
          - status:

### registry
- region:
  - key: kingdom_of_alpha
  - status: active_now
  - locations:
    - key: arkama_city
      - status: future_planned
      - sublocations:
        - key: arkama_sun_church
          - status: future_planned
    - key: arkama_village
      - status: active_now
      - sublocations:
        - key: bridgitte_house
          - status: active_now
        - key: arkama_tavern
          - status: active_now
        - key: arkama_smithy
          - status: active_now

## Status Vocabulary
- active_now
- future_planned
- blocked
- retired

## Controlled Vocabularies
- companion_type: combat, non-combat
- race: human female, night elf, high goblin
- primary_role: (to be expanded)
- secondary_role: (to be expanded)

## Alias Map
- (example) support-healer -> support

## Change Log
- 2026-05-17: Baseline initialized.
- 2026-05-17: Added character naming canon (`companion_name` required, Title Case display names, optional `name_key`, uniqueness rule).
- 2026-05-17: Added `arkama_tavern` (active_now) under `kingdom_of_alpha > arkama_village` in world anchor registry.
- 2026-05-17: Expanded race vocabulary with `night elf`.
- 2026-05-17: Expanded race vocabulary with `high goblin`.
- 2026-05-17: Added `arkama_smithy` (active_now) under `kingdom_of_alpha > arkama_village` in world anchor registry.
