# Short Blade Archetype

## Class Wrapper Name
- Class wrapper: **Ruffian**
- Archetype: **Short Blade + Light Armor**

## Identity Snapshot
Short Blade is an evasive duelist DPS archetype built around sustained bleed upkeep and conversion finishers. It is intentionally weak as a broad meta choice and strongest only in niche matchups with clean uptime.

## Keyword Profile
- Primary keyword: `bleed-conversion`
- Supporting intent: sustained pressure, setup-before-burst, dodge-reactive tempo

## Core Loop
### Ability Capability Inventory

#### Ability Recommendation Block 1
- **Ability Name:** Slashing Cut
- **Gameplay Intent:** baseline upkeep strike that keeps loop cadence stable.
- **Trigger/Condition:** default attack step when no higher-priority archetype capability is available.
- **Tangible Effect:** `Effect: damage + slashing hit to target + no cooldown note`
- **Loop Contribution:** fills cycle space and prepares bleed-conversion sequence.

#### Ability Recommendation Block 2
- **Ability Name:** Open Vein
- **Gameplay Intent:** apply/reinforce bleed-state for conversion setup.
- **Trigger/Condition:** use when bleed is missing or below desired stack state.
- **Tangible Effect:** `Effect: debuff + apply bleed state on target + stack-based DoT note`
- **Loop Contribution:** creates the state that powers finisher conversion.

#### Ability Recommendation Block 3
- **Ability Name:** Piercing Finisher
- **Gameplay Intent:** cash out prepared bleed-state into burst packet.
- **Trigger/Condition:** `buff_piercing_talon >= 2` (placeholder ID).
- **Tangible Effect:** `Effect: damage + high piercing finisher packet, amplified by bleed-state + consumes finisher condition`
- **Loop Contribution:** conversion spike that differentiates short blade from flat sustained kits.

#### Ability Recommendation Block 4
- **Ability Name:** Slip Counter
- **Gameplay Intent:** reward successful defensive timing with offensive continuity.
- **Trigger/Condition:** player dodge success window.
- **Tangible Effect:** `Effect: damage + instant counter pierce + reaction-window/internal-cooldown note`
- **Loop Contribution:** preserves pressure while reinforcing evasive identity.

#### Ability Recommendation Block 5 (Global/Shared)
- **Ability Name:** Auto Attack Fallback
- **Gameplay Intent:** prevent dead ticks when gated abilities are unavailable.
- **Trigger/Condition:** no archetype-capability condition is currently met.
- **Tangible Effect:** `Effect: damage + basic fallback attack + no cooldown note`
- **Loop Contribution:** keeps baseline uptime and smooths rotation failure states.

#### Ability Recommendation Block 6 (Global/Shared)
- **Ability Name:** Bleed Tick Resolution
- **Gameplay Intent:** convert applied bleed state into ongoing pressure over time.
- **Trigger/Condition:** target has active bleed state.
- **Tangible Effect:** `Effect: damage + periodic DoT tick from bleed state + tick-timed resolution note`
- **Loop Contribution:** sustains attrition between direct strikes and supports conversion value.

#### Ability Recommendation Block 7
- **Ability Name:** Talon Momentum
- **Gameplay Intent:** represent short blade’s finisher-readiness builder state.
- **Trigger/Condition:** successful slashing cadence steps.
- **Tangible Effect:** `Effect: resource + gain buff_piercing_talon stack + stack-cap note`
- **Loop Contribution:** provides deterministic progression into finisher windows.

#### Ability Recommendation Block 8
- **Ability Name:** Serrated Followthrough
- **Gameplay Intent:** reinforce bleed upkeep after finisher use.
- **Trigger/Condition:** immediately after successful Piercing Finisher conversion.
- **Tangible Effect:** `Effect: debuff + refresh/extend bleed-state presence + short-duration refresh note`
- **Loop Contribution:** reconnects burst back into sustain loop so cadence repeats cleanly.

**ID Note:** `buff_piercing_talon` is a placeholder. Replace with project canonical IDs before implementation.

### Rotation Trace Identity
- Base cycle: `Slashing Cut -> Slashing Cut -> Piercing Finisher`.
- Functional cycle: build finisher-readiness + maintain bleed -> convert -> re-establish bleed upkeep.

### Level-Band Evolution (1-100)
- **1-20:** fixed three-step cadence, limited branch behavior, training identity.
- **21-40:** cleaner bleed reliability and fewer dead cycle states.
- **41-60:** stronger dependence on proper conversion timing; mistakes are punished.
- **61-80:** dodge-reactive continuity tools improve pressure retention.
- **81-100:** niche optimization improves efficiency in favorable matchups without becoming broad top-tier DPS.

### Capability Boundaries
- Not a burst-first archetype.
- Not a broad anti-immunity solution by default.
- Not intended to outperform generalist DPS classes in neutral matchups.
- Capability-only definition here; encounter execution policy is out of scope.

## Pressure Pattern
Constant chip pressure with periodic conversion spikes. The archetype aims to keep sustained attrition active rather than relying on rare all-in windows.

## Counterplay & Weaknesses
- Hard countered by bleed-immune or anti-DoT defensive profiles.
- Fragile when dodge fails and forced into direct trade patterns.
- Underpowered in early/mid progression by design.
- Conversion value collapses when bleed setup is denied.

## Matchup Notes (optional; may be empty)
- Better into targets that allow prolonged uptime and stackable bleed pressure.
- Worse into anti-bleed kits, forced disengage loops, and strict immunity walls.

## Distinction Check
- Unlike generic burst kits, damage ceiling is state-conversion dependent.
- Unlike pure sustain kits, value hinges on conversion timing quality.
- Unlike control kits, pressure comes from attrition damage identity, not lockdown utility.

## Tuning Levers (Non-numeric first)
- Reliability of bleed application cadence.
- Strictness of finisher trigger conditions.
- Cost of failed dodge windows.
- Access limits on anti-immunity exceptions.
- Progression pacing for uptime tools.

## Failure Modes
- Feels nonfunctional if bleed uptime tools are too unreliable.
- Becomes oppressive if conversion payoff ignores intended fragility.
- Loses identity if non-bleed DoTs feed conversion by default.
- Feels frustrating if early weakness is too punitive before loop mastery.

## Open Questions
- Should any late-game exception allow partial conversion value into non-bleed targets?
- How strict should finisher gating remain at high skill levels?
- Should party support amplify conversion windows, or remain mostly self-contained?