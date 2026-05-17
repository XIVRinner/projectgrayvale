# Companion Designer Skill Design

## Goal
Create a global Pi skill that designs one unique companion per session using an interview-driven process, validates against a canonical NPC baseline, and writes results into region-first roster documentation.

## Scope
- Skill location: `~/.agents/skills/companion-designer/`
- One companion finalized per session
- Region-first documentation model
- Supports long-term scale (e.g., 100+ combat and 100+ non-combat companions) without one giant file or one-file-per-companion sprawl

## Required Inputs
At session start, the skill must read:
1. `docs/companions/npc-baseline.md`
2. `docs/game-design/05-companions-and-social-systems.md`
3. `docs/systems/companions.md`
4. Target region roster file if present: `docs/companions/regions/<region-key>/companions.md`

## Core Workflow
1. **Load context**
   - Read all required inputs.
2. **Interview loop**
   - Ask one question at a time.
   - Resolve companion identity, role, world anchor, meet context, and questline hook.
3. **Baseline gate**
   - If canonical semantics or anchor registry needs change, propose exact edit.
   - Apply only after explicit user confirmation.
4. **Draft companion profile**
   - Write/update a mini profile block under companion name in the regional roster.
5. **Validation pass**
   - Run required consistency checks before finalization.
6. **Finalize or iterate**
   - If checks fail, return to interview/refinement.
   - If checks pass, finalize and summarize changes.

## Baseline Canon File
File: `docs/companions/npc-baseline.md`

Required sections:
1. `# NPC Baseline`
2. `## Purpose & Change Rules`
3. `## Core Static Fields`
4. `## World Anchor Registry`
5. `## Status Vocabulary`
6. `## Controlled Vocabularies`
7. `## Alias Map`
8. `## Change Log`

### World Anchor Registry Requirements
Canonical hierarchy fields:
- `region`
- `location`
- `sublocation`

Each hierarchy layer must have its own `status`.

This ensures scalable content evolution such as adding future cities/areas without breaking earlier companion definitions.

## Directory Strategy (Region-First)
- Global baseline: `docs/companions/npc-baseline.md`
- Regional rosters: `docs/companions/regions/<region-key>/companions.md`

Rules:
- Do not maintain all companions in one monolithic file.
- Do not create one file per companion by default.
- Keep companion entries grouped by region for discoverability and future expansion.

## Mini Profile Block Schema
Each companion block in a regional roster must include:
- Companion Name
- Companion Type (combat / non-combat)
- Race
- Primary Role
- Secondary Role (optional)
- Region
- Location
- Sublocation
- Region Status
- Location Status
- Sublocation Status
- First Meet Context
- Identity Summary
- Questline Hook
- Personality / Social Tags
- Distinctiveness Notes

## Validation Checks
Before finalization, the skill must run:
1. **Anchor validity**
   - Region/location/sublocation exists in baseline registry.
2. **Status compatibility**
   - First meet context aligns with anchor statuses.
3. **Duplicate identity check**
   - Prevent near-identical identity bundles in same region.
4. **Questline uniqueness check**
   - Prevent overly mirrored emotional/quest arcs.
5. **Canon vocabulary check**
   - Race/role/type tags match controlled vocabularies.

## Baseline Change Policy
- If user introduces new semantics (race/role/status/anchor), the skill must pause and propose explicit baseline edits.
- No silent canon drift.
- No baseline write without explicit confirmation.

## Output Contract
At session completion, the skill reports:
- Companion added/updated
- Target file path (`docs/companions/regions/<region-key>/companions.md`)
- Whether `docs/companions/npc-baseline.md` changed
- Any intentionally deferred hooks for future content

## Non-Goals
- No implementation of runtime companion systems
- No balancing-number simulation
- No batch finalization of multiple companions in one session

## Success Criteria
- One companion can be finalized per run with clear identity and questline hook.
- Companion is anchored to canonical `region -> location -> sublocation` with statuses at each layer.
- Baseline semantics remain consistent and explicitly governed.
- Regional roster structure remains maintainable at large scale.
