# Combat Score Framework Design (V1)

## Goal
Define a transparent, capability-representative Combat Score framework that reflects current loadout strength (not assumed level power), supports player and combat companions, and exposes clear math for min-maxing.

## Scope
- In scope (V1):
  - Player Combat Score
  - Combat Companion Score
  - Expected-for-level comparison output
  - Formula transparency, subscores, bottlenecks, generic hints
- Out of scope (V1):
  - Non-combat companion Utility Score (future model)
  - Party aggregate display (future; simple sum of individuals)
  - Encounter-time gameplay policy

## Core Principles
1. Score reflects **actual current loadout/capability**, not a forced level penalty.
2. Player-facing output must be transparent and inspectable.
3. Formulas are explicit and visible.
4. Level expectation is a comparison layer, not a direct penalty layer.

## Scoring Models

### 1) Player Combat Score
Formula:

`PlayerCombatScore = 0.50*Gear + 0.30*SkillProficiency + 0.20*PreferredAttributeForWeapon`

#### Player Inputs
- Gear subscore
- Skill proficiency subscore
- Preferred attribute subscore

#### Preferred Attribute Rules (V1)
- Use raw attribute values (no 100-point normalization model).
- Use effective value for score; show both base and effective.
- Off-hand aware split:
  - Main-hand primary attribute contribution: 80%
  - Off-hand primary attribute contribution: 20%
- If both hands map to same attribute, contribution effectively consolidates to that same attribute.
- If off-hand has no applicable attribute mapping, its contribution is 0 on that side.

### 2) Combat Companion Score
Formula:

`CompanionCombatScore = 0.40*Gear + 0.20*PreferredRoleAlignment + 0.40*StarLevel`

#### Companion Inputs
- Gear subscore
- Preferred role alignment subscore
- Star level progression subscore

### 3) Non-Combat Companion
- Not locked in V1.
- Future separate `Utility Score` model.

## Expected-for-Level Comparison
No direct level-gap penalty is applied to raw combat score.

Comparison layer:
- Build expected baseline from:
  - formula-driven curve
  - manual milestone overrides
- Milestone checkpoints use **player level every 5 levels**.

Output requirements:
- Percentage of expected (e.g., `62% of expected`)
- Tier label (e.g., `Underpowered`, `On Curve`, `Overperforming`)

## Transparency & UX Output Contract
For each scored entity (player, combat companion):
1. Final score
2. Subscores (pillar breakdown)
3. Exact formula text
4. Expected-for-level comparison (percent + tier)
5. Top-3 bottlenecks
6. Generic actionable hints (non-location-based)

Examples of generic hints:
- Upgrade weapon tier
- Equip missing armor slots
- Improve matching weapon skill
- Improve preferred attribute support

## Data/Authoring Requirements (V1)
- Weapon-to-primary-attribute mapping
- Off-hand attribute applicability mapping
- Gear scoring rules
- Skill proficiency scoring rules
- Companion role alignment scoring rules
- Star level scoring contribution rules
- Expected curve parameters + 5-level milestone override table

## Architecture Boundaries
- This is a scoring framework/spec, not runtime combat behavior policy.
- No raid/dungeon/solo decision scripting is included.
- No utility AI policy is included.

## Error Handling / Edge Cases
- Missing off-hand mapping: treat off-hand attribute contribution as 0.
- Missing gear slots: reflected naturally in lower Gear subscore.
- Unknown skill mapping: score as unmet/low proficiency contribution.
- Missing expected-level override: fall back to formula baseline for that level.

## Testing Strategy (Design-Level)
1. **Sanity cases**
   - Strong loadout at high level should score high.
   - Mismatched weapon/skill loadout should score visibly lower.
2. **Attribute split cases**
   - Same-attribute main/off-hand
   - Different-attribute main/off-hand
   - Off-hand no mapping
3. **Comparison cases**
   - Under expected
   - On curve
   - Overperforming
4. **Companion cases**
   - High star + poor gear
   - Strong gear + weak role alignment

## Open Questions
1. How to scale StarLevel contribution curve shape in companion score without forcing hard numeric balance too early?
2. Should expected-tier labels include one neutral middle band or multiple nuanced bands?
3. When Utility Score is introduced, should party aggregate remain simple sum or weighted by activity type?