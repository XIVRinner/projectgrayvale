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

## Status Vocabulary
- active_now
- future_planned
- blocked
- retired

## Controlled Vocabularies
- companion_type: combat, non-combat
- race: (to be expanded)
- primary_role: (to be expanded)
- secondary_role: (to be expanded)

## Alias Map
- (example) support-healer -> support

## Change Log
- 2026-05-17: Baseline initialized.
