# Combat Archetype Designer Skill Design

## Goal
Create a global Pi skill that designs one weapon/player archetype per session via relentless interview, canon-validated keyword semantics, and cross-archetype consistency checks.

## Scope
- Skill location: `~/.agents/skills/combat-archetype-designer/`
- Primary output per run: one finalized archetype document in `docs/combat-system/<category>/<archetype>.md`
- Session style: iterative refinement in-session until archetype is design-complete
- Cross-check baseline: existing archetypes in `docs/combat-system/*` plus in-session drafts

## Inputs and Required References
At session start, the skill must read:
1. `docs/combat-design.md`
2. `docs/superpowers/combat-keyword-canon.md` (authoritative keyword semantics)
3. Existing archetype docs under `docs/combat-system/*`

## Core Workflow
1. **Context load**
   - Read the three required reference sources.
2. **Relentless interview loop**
   - Ask one question at a time.
   - Resolve purpose, fantasy, role, loop, pressure pattern, counters, and failure states.
3. **Canon gate**
   - Detect new keyword usage or semantic drift.
   - Propose exact canon edits.
   - Apply canon edit only after explicit user confirmation.
4. **Archetype drafting**
   - Draft/update one file at `docs/combat-system/<category>/<archetype>.md`.
5. **Cross-archetype comparison pass**
   - Compare against `docs/combat-system/*` + in-session drafts.
   - Flag collisions/overlap/unclear counterplay.
6. **Finalize or iterate**
   - If checks fail, return to interview and revise.
   - If checks pass, finalize the archetype doc.

## Strict Archetype Template
Each archetype document must include these sections:
1. `## Identity Snapshot`
2. `## Keyword Profile`
3. `## Core Loop`
4. `## Pressure Pattern`
5. `## Counterplay & Weaknesses`
6. `## Matchup Notes` *(optional; may be empty)*
7. `## Distinction Check`
8. `## Tuning Levers (Non-numeric first)`
9. `## Failure Modes`
10. `## Open Questions`

## Canon Document Design
File: `docs/superpowers/combat-keyword-canon.md`

Required structure:
- `# Combat Keyword Canon`
- `## Purpose & Rules`
- `## Keyword Entries`
  - canonical definition
  - allowed interpretation boundaries
  - forbidden interpretation boundaries
  - interaction notes
- `## Synonym / Alias Map`
- `## Conflict Log`

Canon behavior rules:
- Canon is authoritative for archetype keyword semantics.
- Canon changes require explicit user confirmation before writing.
- On mismatch, the skill must pause and ask whether to:
  - revise the archetype to fit canon, or
  - revise canon (with explicit approval).

## Cross-Archetype Comparison Rules
The skill must run these checks before finalization:
1. **Keyword collision**
   - Same keyword used with materially different behavior.
2. **Role overlap**
   - Archetypes solving the same combat job in the same way.
3. **Loop uniqueness**
   - Core loop cadence too similar to existing archetypes.
4. **Counterplay clarity**
   - Punish windows not distinct enough.
5. **Design-space guardrail**
   - “Does not do X” boundaries contradict existing archetype boundaries.

Output format:
- Compact pass/fail summary in chat.
- Failed checks route back to interview/refinement loop.

## Non-Goals
- No implementation of runtime combat mechanics.
- No balancing numbers engine.
- No multi-archetype finalization in a single run.

## Success Criteria
- One archetype can be fully designed and finalized per session.
- Keyword semantics remain consistent with canon.
- Canon evolves only via explicit approvals.
- Final archetype docs are distinct and non-overlapping with existing design space.
