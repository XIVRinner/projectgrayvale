---
name: lore-story-designer
description: Design and organize GrayVale lore, storylines (main/side/unlock), companion-linked narrative, glossary terms, and wiki-style documentation through structured interview + documentation mapping.
---

# Lore & Story Designer

Use this skill when the user wants to create, expand, or refine lore/story docs.

## Mission
- Keep lore scalable and navigable.
- Run back-and-forth interviewing to clarify intent before writing canon.
- Keep a living docs map updated on every new lore entry.
- Maintain glossary-first clarity for onboarding terms (example: "night elf").
- Link companion lore to existing companion planning docs.

## Required files
Always treat these as core:
1. `docs/lore/docs-map.md` (navigation source of truth)
2. `docs/lore/glossary.md`
3. `docs/lore/companions/index.md`
4. `docs/companions/regions/*/companions.md` (existing companion planning docs)

## Workflow (mandatory)
1. **Ask one question at a time** until story intent is clear.
2. **If ambiguity remains, ask** (never silently decide canon).
3. **Draft/expand lore docs** using templates in `docs/lore/templates/`.
4. **Update docs-map immediately** with links to any new/changed lore doc.
5. **Update glossary** for any new term, race, faction, artifact, region, or doctrine.
6. **If companion is involved**, update `docs/lore/companions/index.md` and link to relevant `docs/companions/.../companions.md` section.
7. **Run consistency check**:
   - no orphan pages
   - all new terms defined
   - companion lore cross-linked
   - arc type tagged (main / side / unlock / companion)

## Wiki style rules
- Use compact, scan-friendly sections.
- Prefer headings, infobox-style metadata, bullet lists, and relative links.
- Separate **Known Facts**, **Rumors**, **Open Questions** when certainty differs.
- Keep pages reusable as ad-hoc wiki articles.

## Storyboarding interview pattern
When user gives a story idea:
- Capture premise in 1-2 lines.
- Ask targeted question sequence (one at a time):
  1. Narrative purpose
  2. Timeline placement
  3. Factions/characters
  4. Conflict + stakes
  5. Player-facing outcomes
  6. Canon certainty (fixed vs tentative)
- Summarize and confirm before writing canon docs.

## Guardrails
- Do not invent unresolved world rules.
- If blocked, add:

```md
GAP: <short title>
Blocked on: design | canon decision
Needs: <missing decision>
Do not finalize until: <condition>
```

## Output style
- Keep responses concise.
- Always list changed file paths.
- After changes, provide a short “Map updated: yes/no” status.
