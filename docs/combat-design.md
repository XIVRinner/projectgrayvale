# Combat System Concept — Compiled Design

## 1. Base Philosophy

* Combat is **tag-driven first, numbers-driven second**.
* Tags describe identity, behavior, weaknesses, resistances, counters, mechanics, and tactical meaning.
* Numeric stats determine how strongly those tags matter.
* The goal is to allow:

  * enemy variety
  * weapon variety
  * build variety
  * party diversity
  * counterplay
  * discovery
  * scalable encounter design

Combat should not be a pile of hardcoded enemy-specific logic. Most things should be defined through reusable models:

* enemies
* abilities
* buffs
* debuffs
* passives
* actives/procs
* skills
* weapons
* resources
* tags
* loot tables
* activities
* dungeons
* boss timelines

The same core combat engine should support:

* one player vs one weak enemy
* one player vs several enemies
* player + NPCs
* dungeon combat
* special bosses
* raid bosses
* challenge-style scaling

The difference between a coyote and a raid boss is not that they use completely different systems. The difference is the amount of data, mechanics, tags, abilities, and timeline complexity.

---

## 2. Core Model Philosophy

The core combat model should support:

* actors

  * player
  * NPC allies
  * enemies
  * bosses
* tags
* abilities
* passives
* buffs
* debuffs
* actives/procs
* resources
* cooldowns
* cast times
* range
* threat rulesets
* combat logs
* deltas
* loot/reward stubs
* difficulty
* level difference effects

Definitions are static data.

Combat state is runtime data.

Example static definition:

* coyote has base HP, tags, scratch ability, drop table.

Example runtime state:

* this coyote currently has 12 HP, scratch on cooldown, bleeding applied, and is at range 0.

---

## 3. Tag Philosophy

Tags are the main descriptive language of combat.

Example coyote tags:

```text
beast
rank_g
attack_slashing
defensive_dodge
element_nature
weakness_slashing
weakness_fire
weakness_piercing
resistant_thrusting
immune_nature
```

Tags can describe:

* creature family

  * beast
  * humanoid
  * undead
  * construct
* rank

  * rank_g
  * elite
  * boss
* attack type

  * attack_slashing
  * attack_magic_fire
  * attack_ranged
* defense style

  * defensive_dodge
  * defensive_block
  * defensive_barrier
* element

  * element_nature
  * element_fire
* weakness

  * weakness_fire
  * weakness_slashing
* resistance

  * resistant_thrusting
  * resistant_magic_damage
* immunity

  * immune_fire
  * immune_nature
* ability/mechanic identity

  * interruptable
  * summon_minion
  * fire_breath
  * tank_buster

Tags should be human-readable in the UI.

Example:

```text
summon_minion -> Summon Minion
weakness_fire -> Weakness: Fire
interruptable -> Interruptable
```

Tags should be backed by a registry, likely something like:

```text
tags.json
```

The registry should define what tags mean, how they display, and how they interact with other systems.

---

## 4. Tag Interaction Philosophy

Tag interaction is **not simple same-tag cancellation**.

For example:

* `fire_damage` does not get negated by another `fire_damage` tag.
* `immune_fire` means fire damage becomes 0.
* `resistant_fire` means fire damage is reduced by fire resistance.
* `resistant_magic_damage` means broader magic-family damage is reduced.

Damage tags should support inheritance or family grouping.

Example damage taxonomy:

```text
damage
  physical_damage
    slashing_damage
    piercing_damage
    thrusting_damage
    blunt_damage

  magic_damage
    fire_damage
    nature_damage
    dark_damage
    frost_damage
    lightning_damage
```

A fire spell may have:

```text
magic_damage
fire_damage
```

So it can be affected by:

* generic magic resistance
* fire resistance
* fire immunity
* fire weakness
* magic damage modifiers
* fire damage modifiers

“Spell tank” is not a special abstract counter. A spell tank is simply an actor with high magic resistance, relevant tags, and good defensive numbers.

---

## 5. Enemy Philosophy

Enemies should be mostly data.

An enemy should define:

* id/key
* display name
* level
* difficulty
* base HP
* tags
* armor/resistance profile
* spell resistance profile
* defensive capabilities
* abilities
* ability pattern
* resources, even if empty
* loot/drop fields, even if empty for MVP
* optional behavior overrides

Enemies can have many tags. That is intentional.

The purpose of many tags is to allow broad systems to apply to many enemies. For example:

* a weapon may exploit `weakness_piercing`
* a skill may deal `slashing_damage`
* a passive may increase damage against `beast`
* a dungeon modifier may affect `rank_g`
* an ability may fail against `immune_nature`

---

## 6. Enemy Groups and Combat-Layer Tags

Combat can add extra tags based on the encounter group.

Example:

Three coyotes create combat-layer tags:

```text
multiple
count_3
```

This allows abilities to reason about the encounter.

Example:

* scythe has `aoe_attack_5`
* enemy group has `count_3`
* scythe can hit all three

But damage is still evaluated per target.

Example:

* two coyotes are weak to fire
* one coyote tamer is not weak to fire
* fire AoE hits all three
* coyotes take extra damage
* tamer does not

Group tags describe formation. They do not erase individual target properties.

---

## 7. Enemy Stats and Resistances

Enemies should have:

* base HP
* level
* difficulty
* physical armor/resistance
* spell/element resistance
* defensive capabilities
* optional resources

Physical resistance categories include:

```text
slashing
piercing
thrusting
blunt
```

Missing physical resistance defaults to `0`.

Spell/element resistance is per element or family.

Missing spell resistance defaults to `0`.

Resistance values are generally **flat reductions**.

Example:

```text
incoming fire damage: 20
fire resistance: 8
final damage before other modifiers: 12
```

Armor is also flat reduction.

Negative armor is flat bonus damage.

Example:

```text
armor: -10
incoming physical damage gains +10
```

This can become very powerful with multihit physical builds, so physical negative armor is dangerous and should be balanced carefully.

Magic negative resistance uses a coefficient from the balance profile.

Example concept:

```text
negative_resistance_bonus = abs(negative_resistance) * coefficient %
```

If coefficient is `2`:

```text
fire_resistance = -10
bonus = 20%
```

That coefficient should come from a balance profile, not be hardcoded on the enemy.

---

## 8. Immunity Philosophy

Immunity overrides normal weakness/resistance behavior.

If a target is immune to fire:

* fire damage does 0
* fire weakness does nothing
* fire resistance reduction does not help
* fire dots cannot be applied
* debuffs do not bypass immunity unless a special ability explicitly pierces immunity

Immunity can eventually be:

* permanent
* temporary
* removable
* pierceable by special abilities
* partial
* damage-only
* debuff-application-only

For MVP:

* immunity to a damage type means no damage of that type and no dot application of that type.

Implementation-wise, avoid `NaN` for immunity because it can poison calculations.

Prefer something explicit, such as:

```ts
resistanceMode: "normal" | "immune"
```

or:

```ts
immune: true
```

or:

```ts
value: Number.POSITIVE_INFINITY
```

The important part is that immunity is checked clearly and early.

---

## 9. Balance Profile Philosophy

Balance profiles define global coefficients and scaling behavior.

They may contain:

* negative resistance coefficient
* level difference scaling curve
* difficulty modifiers
* default damage variance
* default cooldown behavior
* default refresh multiplier
* contribution rules
* death penalty rules

For now, avoid enemy-specific balance exceptions unless necessary.

Later, some enemies may need specific overrides per difficulty.

---

## 10. Difficulty Philosophy

Enemies can have levels separate from difficulty.

Level is a progression and scaling concept.

Difficulty is mostly relevant for:

* raids
* special bosses
* dungeon end bosses
* challenge content

Difficulty can alter:

* base stats
* ability timeline
* damage numbers
* HP
* reward scaling

Difficulty tiers:

```text
story
normal
hard
nightmare
torment
cataclysm
challenge
challenge+
```

Basic solo enemies, like huntable coyotes, may have `story` difficulty hidden from the player for model uniformity.

Special bosses:

* normal to cataclysm
* no story
* no challenge

Dungeons:

* start at normal
* can have challenge
* no story

Raid bosses:

* can go up to challenge+

Challenge+:

* increases health by %
* increases damage done by %
* slightly improves rewards
* does not change armor
* does not change resistance values
* does not fundamentally change the boss model

---

## 11. Level Difference Philosophy

Level difference creates a player-facing penalty/debuff.

The enemy’s HP is shown honestly.

Example:

```text
Boss HP: 10,000
Level difference penalty: +999% damage taken
```

The idea is that players can attempt high-level enemies, but the UI should clearly show why it is dangerous.

Level difference scaling should grow aggressively.

Rough example:

```text
1 level difference: 0%
2 levels: 5%
3 levels: 15%
10 levels: 95%
25 levels: 250%
```

The exact formula is not final, but each additional level gap should hurt more than the previous one.

Player level matters, but skill matters more when fighting appropriate enemies.

Damage and defense can scale from:

* player level
* relevant weapon skill
* relevant magic/element skill
* gear
* agility
* dodge gear
* buffs
* passives

Weapon skill matters more than player level when fighting same-level enemies.

---

## 12. Tick-Based Combat Philosophy

Combat is fully tick-based.

One tick equals one action opportunity.

Player and enemies usually act on the same tick interval.

This creates “trading blows.”

Examples of actions that can consume the attack/action slot:

* attack ability
* auto attack
* spell cast action
* bow draw action
* movement
* ranged disengage
* melee engage
* special ability

However, buffs, heals, and defensives are extra actions unless the ability says otherwise.

So the core rule is:

* one attack per tick
* extra actions can happen in the same tick
* casting for multiple ticks prevents attack and buff usage

---

## 13. Prep Phase

Most encounters begin with 2 prep ticks.

These are mechanically active.

During prep ticks:

* cooldowns tick down
* mana regeneration can happen
* other resource regeneration can happen
* the player can flee/cancel combat
* the player can notice bad state, such as low HP

Prep ticks are for:

* soft loading
* readability
* player awareness
* last chance to cancel

They are not a frozen cinematic.

Example:

```text
Prep Tick 1: Encounter begins.
Prep Tick 2: You notice your HP is low. You may flee.
Tick 1: Combat starts.
```

---

## 14. Tick Resolution Order

Default tick order can be:

```text
1. prep/start tick handling
2. cooldown tick-down
3. resource regeneration
4. dot/hot resolution
5. death check from start-of-tick effects
6. extra action selection
7. attack action selection
8. resource/cost check
9. cast progress check
10. simultaneous action resolution
11. hit/dodge/parry/block/barrier/absorb checks
12. damage calculation
13. effect application
14. resource generation
15. cooldown application
16. post-action death check
17. delta emission
18. combat log emission
```

But the cycle should be hook-based and reorderable.

Systems should be able to insert or reorder hooks later.

Example hooks:

```text
prep_tick
start_tick
cooldown_tick
resource_regen
dot_resolution
death_check_pre_action
extra_action_selection
attack_selection
cost_payment
cast_resolution
defense_resolution
damage_resolution
effect_application
resource_generation
death_check_post_action
delta_emit
log_emit
```

This is important because future mechanics may need special timing.

---

## 15. Simultaneous Action Resolution

Player and enemy attacks resolve at the same time.

If player and enemy both select attacks:

* both attacks resolve
* even if player kills enemy, enemy still deals its selected attack
* if both die, player loses
* player must survive to win

Exception:

* dots and start-of-tick effects resolve before attacks
* if a dot kills an actor before action selection/resolution, that actor does not attack

Example:

```text
Tick 5 start:
Coyote dies from bleed.
Coyote does not scratch this tick.
```

But:

```text
Tick 5 actions:
Player attacks coyote.
Coyote scratches player.
Player kills coyote.
Coyote still scratches because the action was simultaneous.
```

---

## 16. Death and Defeat Philosophy

Player death is not game over.

If the player dies:

* combat ends
* no loot is awarded
* death penalty is applied
* player cannot attack for a short time

Repeated deaths increase penalty.

Example:

```text
first recent death: 10 seconds
second recent death: 30 seconds
later deaths: up to 2 minutes
```

Penalty has falloff over time.

If both player and enemy die in the same tick:

* it is a loss
* no loot is dropped

Dots remain after the applier dies.

If a dot applier dies:

* existing dots continue until expired

Companions can revive only through specific actions.

Enemies can flee only if they have the relevant tag and ability.

---

## 17. Action Priority Philosophy

Default priority is:

```text
1. Buff
2. Heal
3. Defensive
4. Consume proc
5. Interrupt if possible
6. Use next available action
7. Auto attack
8. Move if required
```

Interrupts happen after procs because some procs may themselves interrupt or push back casts.

There is no hidden emergency layer.

If the player dies while a heal or defensive was available, that is acceptable. The system does not secretly save the player. Survival tools must be modeled as actual abilities.

Example rare ability:

```text
On fatal hit, restore 20% HP.
Cooldown: 2000 ticks.
```

Failure is allowed. Preparation matters.

---

## 18. Extra Actions

Buffs, heals, and defensives are generally extra actions.

This means an actor can:

* apply a buff
* heal
* use a defensive
* then still perform one attack action

But:

* attack is once per tick
* either via ability or auto attack
* do not attack twice unless an ability explicitly creates multihit
* if an actor is casting for more than one tick, they cannot attack or buff during that cast unless the ability explicitly allows it

Default:

```text
buffs = extra actions
heals = extra actions
defensives = extra actions
attack = one per tick
movement = action unless special rule
casting = locks normal actions
```

---

## 19. “Next Available Action”

“Next available action” means:

* if a stack-consuming attack is available, use it
* otherwise use an available cooldown ability
* otherwise use auto attack

It should not cause multiple attacks in the same tick.

In raid scenarios:

* this applies mainly to damage actions and damage cooldowns
* utility, interrupts, and mechanic assignments are handled separately

---

## 20. Cast Philosophy

Casts can take more than one tick.

Interruptable casts generally last more than one tick, allowing actors time to respond.

If the target of a casted ability dies before the cast finishes:

* choose the next available valid target
* target selection can be different for friendly and foe

Magic auto attacks can be modeled as:

```text
cast for X ticks
then resolve ability
```

Bosses can have long casts that hit hard.

---

## 21. Cooldown Philosophy

Cooldowns tick down at the start of the next tick.

Example:

```text
Tick 3: Coyote uses Scratch.
Tick 4 start: Scratch cooldown decreases.
```

This applies to:

* abilities
* procs
* internal cooldowns
* reactions
* defensive cooldowns

---

## 22. Resource Philosophy

Resources are first-class combat mechanics.

Mana is important, but many resources should exist.

Examples:

```text
mana
rage
focus
energy
combo
harvesters_swing
piercing_talon
holy_power
divinity
bow_draw
shield_value
resolve
boss_energy
```

Resources can belong to different scopes:

* actor-specific
* target-specific
* source-specific
* combat-specific
* encounter-specific
* out-of-combat-prepared
* buff-as-resource

Mana:

* belongs to actor
* does not regenerate by default
* requires equipment, potion, buff, passive, or other effect to regenerate

Rage:

* can be built by being hit
* can be spent on large attacks or tank actions

Divinity / holy power:

* may not regenerate during combat
* may require praying or preparation between fights

Boss energy:

* can be treated like mana or another actor resource

---

## 23. Resource-as-Buff Philosophy

Many resources are actually buffs or stacking effects.

Examples:

```text
combo
harvesters_swing
piercing_talon
bow_draw
rage
holy_power
```

A buff/resource can be:

* visible
* hidden
* actor-specific
* target-specific
* source-specific
* stackable
* spendable
* expiring
* non-expiring during combat
* generated by hit
* consumed by ability
* refreshed by action

This suggests resources and buffs should share infrastructure.

---

## 24. Buff and Debuff Philosophy

Most debuffs do not stack.

Stacking debuffs are the exception, not the rule.

Default non-stacking debuff behavior:

* same debuff with higher value overwrites weaker one
* weaker version does not overwrite stronger one
* weaker version does not refresh stronger one
* same-strength reapplication can refresh duration
* refresh duration can extend up to 1.5x original duration

Example:

```text
Target has Fire Weakness 20%.
Fire Weakness 10% is applied.
Result: nothing changes.
```

Debuffs are numerical.

There should not be separate tags like:

```text
fire_weakness_1
fire_weakness_2
```

Instead:

```text
fire_weakness: 10%
fire_weakness: 20%
```

Stacking debuffs are source-specific by default.

Example:

* dual dagger player A applies bleed stacks
* dual dagger player B applies their own bleed stacks
* these are separate source-specific stacks

But the model should still explicitly define stack behavior.

Important fields:

```text
debuff_id
source_actor_id
potency
duration
max_refresh_duration
stackable
max_stacks
source_specific
overwrite_policy
affected_stat
```

---

## 25. Dot Philosophy

Dot application does not deal damage immediately.

No exceptions.

The order is:

```text
apply dot
wait until next tick
dot resolves
```

Dots resolve near the start of the tick before actions.

If a dot kills a target before actions, that target does not act.

Dots continue after the applier dies.

Bleed damage updates dynamically rather than snapshotting. Since the player does not have direct agency over exactly when bleeds are applied, dynamic calculation is preferred.

---

## 26. Defensive Philosophy

Defensive types include:

* dodge
* parry
* block
* barrier
* absorb shield

### Dodge

Dodge is a player stat.

Dodge requires dodge-supporting gear and armor type.

Dodge can apply to:

* physical attacks
* spells

Dodge:

* negates 100% of incoming damage
* increases range by +1
* is capped at 90%
* cannot reach 100%
* is affected by level difference
* scales from base dodge, agility, and gear
* is highly dependent on flat dodge bonuses from gear

Example:

```text
Ring of Dodge
+12% dodge at level 10
```

Heavy armor has an innate passive that heavily penalizes dodge, currently described as something like:

```text
-100% bonus dodge
```

Enemy accuracy does not exist.

### Parry

Parry requires specific weapons.

Examples:

* parrying dagger
* sword

Parry cannot parry spells.

### Block

Block requires shields. Negates all types but weaker against spell.

### Barrier

Barrier is spell-based. Negates all types.

### Absorb Shield

Absorb shield prevents damage up to its stored amount.

---

## 27. Dodge Movement

Dodge always applies movement.

When player dodges:

```text
damage = 0
range += 1
```

This can be good or bad.

It can help ranged builds.

It can hurt melee uptime.

For MVP, edge cases can wait.

---

## 28. On-Dodge Reactions

On-dodge effects are free actions.

For the old dagger / short blade example:

* if player dodges
* trigger instant pierce
* does not count as normal attack
* does not consume `piercing_talon`
* can generate resources
* can apply bleed
* has internal cooldown
* can happen once per tick at most

Only player dodge is relevant for this specific proc.

Enemies can eventually have dodge too, but this specific on-dodge proc is player-side.

---

## 29. Damage Formula Philosophy

Accepted general shape:

```text
base ability damage
× weapon modifier
× stat modifier
× damage roll
× weakness/resistance modifier
× difficulty modifier
× buff/debuff modifiers
= final damage
```

But with these important rules:

* damage intervals are integer-only
* decimals are not allowed
* damage rolls are integer rolls
* resistances are flat reductions
* armor is flat reduction
* negative armor is flat bonus damage
* physical negative armor adds directly
* magic negative resistance uses coefficient logic
* 0 damage means miss
* negative damage means miss unless a special tag says otherwise
* immunity overrides everything

Example special tag:

```text
slashing_heals
```

If final slashing damage is negative and target has `slashing_heals`, negative damage becomes healing.

Player-facing log should show:

```text
Miss
```

Debug log can include the actual calculation.

---

## 30. Multi-Damage and Skill-Driven Weapon Behavior

Weapons do not define full combat behavior by themselves.

Skills define behavior.

Weapons define damage intervals, tags, modifiers, requirements, and special item exceptions.

Example old dagger:

```text
piercing damage: [5, 10]
slashing damage: [2, 5]
```

Short blade skill defines:

* slash-slash-pierce rotation
* piercing talon stacks
* piercing finisher
* bleed chance on piercing
* on-dodge instant pierce
* attack damage reduction debuff

A legendary dagger may add exceptions.

Example:

```text
Legendary dagger:
slashing attacks can apply bleed
```

But old dagger does not.

This separation is important:

```text
weapon = numbers and item-specific modifiers
skill = behavior and rotation
```

---

## 31. Weapon Philosophy

Weapons are tactical identities, not just stat sticks.

A weapon can define:

* damage intervals
* damage types
* tags
* requirements
* modifiers
* range behavior
* item-specific effects
* compatible skills

Examples:

### Rapier

* thrusting-focused
* interacts with thrusting weakness/resistance

### Scythe

* AoE potential
* may have `aoe_attack_5`
* good against enemy groups

### Bow

* ranged start behavior
* draw ticks
* optimal range
* minimum range
* required range
* distance gain

### Spear

* possible charge behavior
* can interact with range
* lance charge can trigger when enemy is far enough

### Old Dagger

* short blade weapon
* piercing [5, 10]
* slashing [2, 5]
* uses short blade skill behavior

---

## 32. Skill Philosophy

Skills define how weapon categories behave.

Examples:

```text
short_blade
spear
bow
twin_saber
two_handed_hammer
```

Skills can define:

* rotations
* passives
* proc rules
* resource generation
* resource spending
* abilities
* conditions
* cooldowns
* damage packet behavior

For old dagger, the short blade skill defines the combat pattern.

---

## 33. Old Dagger / Short Blade MVP

Old dagger belongs to the short blade archetype.

Weapon damage:

```text
piercing: [5, 10]
slashing: [2, 5]
```

Short blade rotation:

```text
Tick 1: slashing attack, gain 1 piercing_talon
Tick 2: slashing attack, gain 1 piercing_talon
Tick 3: consume 2 piercing_talon, piercing finisher
Repeat
```

`piercing_talon` stacks are created by any slashing damage.

Piercing attacks have high chance to apply bleeding.

Slashing attacks do not apply bleeding.

Piercing finisher can apply bleed.

On dodge:

* instant pierce
* free action
* does not consume `piercing_talon`
* can generate resources
* can apply bleed
* applies attack damage reduction debuff
* once per tick max
* has internal cooldown

Bleed:

* stacks up to 5
* 1 stack = 30% of piercing damage
* 5 stacks = 150% of piercing damage
* dynamically updates
* source-specific
* does not deal damage on application
* resolves next tick

Attack damage reduction from dodge-pierce:

* reduces all damage done by target by 5%
* for MVP, only direct damage needs to be reduced
* duration: 3 ticks for now
* may reduce active dot effects later

---

## 34. Ability Philosophy

Abilities are reusable and parameterized.

Abilities should not be unique one-off scripts unless necessary.

Examples:

```text
auto_attack
scratch
wide_slash
magic_auto_attack
ranged_auto_attack
interrupt
dark_harvest
```

Abilities can define:

* tags
* damage type
* damage source
* cooldown
* cast time
* target rules
* range requirements
* resource cost
* resource generation
* buff/debuff application
* dot application
* proc behavior
* whether it consumes action
* whether it is extra action
* whether it is interruptable

Abilities can be attached from:

* skills
* weapons
* classes
* enemies
* NPCs
* buffs
* passives
* actives/procs
* encounter mechanics

---

## 35. Buffs, Passives, Actives, and Procs

### Buffs

Buffs are temporary state changes.

They can:

* increase damage
* increase healing
* reduce damage taken
* increase attack speed
* create multihit
* add tags
* modify resources
* modify range
* modify cooldowns

### Passives

Passives are persistent conditional rules.

They can come from:

* weapon
* skill
* class
* NPC
* food
* external buff
* equipment

Example:

* bow users try to gain distance
* NPC grants +5% ranged damage

### Actives / Procs

Actives are conditional triggered abilities.

They may become available after conditions are met.

Example:

`Dark Harvest`:

* after hitting the same target 3 times
* focus an energy beam
* applies `dark_resistance_down -1`
* makes next 3 hits stronger
* requires same target tracking

Some actives are also abilities.

---

## 36. Targeting Philosophy

Targeting should be data-driven.

Abilities can target:

* main threat
* random target
* lowest HP
* highest HP
* self
* all enemies
* all allies
* up to N targets
* assigned target
* same target as previous
* targets with tag
* targets without tag

Random target selection should not casually override player assignment.

If player assigns an NPC to an enemy:

* NPC attacks that target until it dies
* unless disrupted by mechanics

Randomness is allowed for:

* boss mechanics
* confusion
* chaos effects
* explicitly random abilities

Example:

* add uses confusion
* for 2 ticks, assigned NPC may attack random targets, including friendly targets
* after confusion ends, NPC returns to assigned target

---

## 37. Threat Philosophy

Threat should be ruleset-based.

Enemy abilities reference threat rulesets.

Examples:

```text
main_target
highest_threat
support_priority
tank_priority
lowest_hp
random_target
```

Initial simple rules:

* tank generates the most threat
* healer/support generates extreme threat
* DPS generates normal threat
* if two DPS, prefer the one with lower HP/defense

Later this can become more mathematical.

---

## 38. Enemy Ability Patterns

Normal enemies use simple patterns.

Coyote MVP:

* round-robin style
* auto attack unless special ability is available
* scratch has 4 tick cooldown

Scratch:

* deals direct damage
* applies weak bleeding dot
* bleed lasts 1 tick
* cooldown: 4 ticks

Coyote can have defensive capability, such as dodge, if defined.

Enemies should define what defensives they are capable of using.

---

## 39. Range Philosophy

Range is abstract, not grid-based.

```text
range 0 = melee range
range > 0 = distance
```

Most fights start at range 0.

Ranged weapons can alter start range.

Range-related weapon fields:

```text
start_range
draw_tick
optimal_range
min_range
required_range
gain_distance
```

Movement consumes an action unless defined otherwise.

Examples:

* melee enemy moves closer by 1 range per tick
* ranged enemy tries to maintain optimal range
* bow requires enough range to draw/fire
* spear may charge from range 3

Dodge always adds +1 range.

Range can later affect:

* threat
* targeting
* ability availability
* enemy movement
* kiting
* charge attacks
* ranged penalties

---

## 40. Party Philosophy

The player can fight with friendly NPCs.

Party size depends on activity.

Typical range:

```text
solo
2-8 party members
```

Some fights allow only one companion.

Some activities allow larger parties.

NPCs should use the same combat model where possible:

* tags
* roles
* abilities
* passives
* buffs
* resources
* defensives
* threat behavior

Normal combat uses dumb AI.

NPC behavior:

* tanks tank
* DPS attacks assigned or obvious target
* support/healer follows priority
* cooldowns are used when available
* interrupts are used if possible
* first-fit logic

Raid/special encounters rely more on player assignment.

Tank switches are not automatic. Player assigns a new tank.

---

## 41. Boss / Raid / Special Encounter Philosophy

Bosses use the same core system as normal enemies.

They differ through:

* ability timeline
* phases
* mechanic tags
* more complex buffs
* assignment needs
* difficulty scaling
* larger numbers
* more important counters

Boss timeline can include:

* ordered steps
* repeating steps
* phase changes
* casts
* summons
* buffs
* debuffs
* stance swaps
* mechanics

Boss abilities can have tags:

```text
interruptable
fire_damage
magic_damage
summon_minion
tank_buster
aoe
defensive_required
```

Bosses can gain or lose tags during combat.

Example:

* boss casts stance
* gains resistance to piercing
* gains weakness to slashing
* later swaps stance

Raid planning uses tags and assignments.

Example:

* boss mechanic: fire breath
* intended answer: spell tank
* alternate answer: golem with fire immunity
* alternate answer: high fire resistance

The system should value non-standard solutions.

Solo raid-like encounters:

* player is automatically assigned to every mechanic
* system checks whether player can survive or counter them

---

## 42. Raid Contribution Philosophy

Contribution credit should account for enabled damage.

Example:

* Player B hits for 120
* Player A’s debuff contributed +20
* Player B gets 120 direct damage credit
* Player A gets +20 contribution damage credit

If nine players buff one player to deal 10,000 damage, all nine contributors should receive contribution credit based on what they enabled.

Eventually the damage formula should expose a breakdown:

```text
direct_damage
buff_contribution
debuff_contribution
resistance_reduction_contribution
raid_damage_contribution
```

Not MVP-critical, but the design should not block it.

---

## 43. Reward / Loot Philosophy

Each enemy has a drop list.

Drops can define:

* item ID
* drop chance
* quantity
* max drop count
* quality rules
* required skill basis
* whether multiple drops can happen together

Example coyote:

* hide
* meat
* maybe coyote heart

A coyote cannot drop two hearts.

Crafting drops should define the skill they are based on.

Examples:

* hide uses skinning
* meat uses butchering

If player lacks the required unlock skill, treat skill level as 0.

Loot can be modified by activity.

Example:

* coyote outside dungeon drops hide/meat
* coyote inside dungeon also drops pennies via dungeon loot modifier

For MVP:

* reward fields should exist in the model
* full reward calculation is not required
* empty arrays/stubs are acceptable

---

## 44. Dungeon Philosophy

Dungeons are generated instances.

They can be left and returned to.

Early dungeons:

* short
* maybe 5 minutes
* max 3 floors

Later dungeons:

* can be very long
* even 1000 floors
* not meant to be completed quickly

Dungeon structure is linear with branching paths.

Example:

```text
START
Floor 1 - Room 1
Path 1 / Path 2 / Path 3
Floor 1 - Room 2
...
End Boss
```

Dungeon definitions are stored in JSON.

Dungeon data can define:

* floors
* room count per floor
* possible room types
* enemy pool
* encounter pool
* mystery pool
* treasure rules
* boss pool
* global loot modifiers

Room types:

```text
combat
floor_boss
encounter
mystery
treasure
end_boss
```

### Encounter Rooms

Non-combat or not-yet-defined interaction.

Could be:

* small event
* empty room reward
* NPC
* trap
* discovery

Encounters should be reusable across dungeons.

### Mystery Rooms

Broad extensibility point.

Could become:

* event
* puzzle
* surprise fight
* special reward
* unknown mechanic

### Treasure Rooms

Treasure rooms contain chests.

Chests do not necessarily have enemy guards.

“Guards” should mean access flags/conditions.

Chest can define:

* requires key
* requires lockpicking
* requires puzzle solved
* requires dungeon state
* requires enemy cleared
* already looted
* max per player reached

Treasure room may also contain enemies, but that is separate.

Treasure rules can define:

* max treasure rooms per dungeon
* min treasure rooms per dungeon
* missable treasure
* guaranteed treasure path
* max loots per player

### Floor Boss Rooms

Structural marker for increasing floor count.

May or may not contain an actual combat boss.

### End Boss

Dungeon end bosses use raid-style timeline/planning.

Regular dungeon enemies can stay simple.

---

## 45. Activity Philosophy

Combat is an activity.

Dungeons, raids, special bosses, and normal fights are also activities or activity variants.

Activities define:

* allowed party size
* enemy group
* difficulty availability
* loot modifiers
* dungeon rules
* raid assignment rules
* failure behavior
* completion conditions

Examples:

* basic combat activity
* dungeon activity
* raid activity
* special boss activity

---

## 46. Worldgraph Integration Philosophy

Worldgraph should wire into combat at the activity level.

Worldgraph probably does not need to understand all combat internals.

It should know:

* where combat starts
* what activity is entered
* what enemies/activity data are used
* what happens after success/failure
* what delta is returned

Examples:

```text
hunt coyote node -> basic combat activity
dungeon entrance -> dungeon activity
raid entrance -> raid activity
```

Combat returns a delta.

The broader game applies the delta according to the existing methodology.

---

## 47. Delta Philosophy

Combat results should return a **delta**, not just a generic result object.

Delta can include:

* HP changes
* resource changes
* buffs applied
* debuffs applied
* effects expired
* enemy defeated
* player defeated
* loot awarded
* penalties applied
* activity completed
* dungeon progress updated
* world flags changed
* skill XP gained
* logs generated

Possible MVP shape:

```ts
{
  activityId: string;
  outcome: "victory" | "defeat" | "fled";
  ticksElapsed: number;
  actorChanges: ActorDelta[];
  resourceChanges: ResourceDelta[];
  effectsApplied: EffectDelta[];
  effectsExpired: EffectDelta[];
  loot: LootDelta[];
  penalties: PenaltyDelta[];
  logs: CombatLogEntry[];
}
```

Combat should produce deltas rather than directly mutating everything.

---

## 48. Combat Log Philosophy

Everything should be logged per tick for development.

The log should include:

* tick number
* actions selected
* buffs used
* heals used
* defensives used
* attacks
* damage rolls
* misses
* dodges
* parries
* blocks
* barriers
* absorbs
* cooldown changes
* resource changes
* debuffs applied
* dots ticking
* deaths
* flee events
* loot rolls
* delta summary

Player-facing UI can later filter this.

Debug view should expose full calculation.

Player-facing view should say:

```text
Miss
```

rather than:

```text
0 damage
```

Metrics should track:

* damage done
* healing done
* debuffs applied
* raid damage contribution
* damage prevented
* interrupts
* key actions
* resource generated
* resource spent

---

## 49. Randomness Philosophy

Combat flow is deterministic, but resolution can be random.

Deterministic:

* player presses start
* combat auto-resolves
* tick order is predictable
* priority is predictable
* cooldowns are predictable
* assignments are respected

Random:

* dodge chance
* damage rolls
* proc chance
* crit chance, if added
* boss random targeting
* confusion targeting
* special random mechanics

Randomness should not casually override player agency.

Player assignment should be respected unless a mechanic disrupts it.

---

## 50. MVP Combat Slice

The MVP should be:

```text
player with old dagger
vs
single coyote
```

Single target.

Single enemy.

Single weapon.

Basic fight.

It should show:

* 2 prep ticks
* ability priority
* tick loop
* simultaneous trading blows
* old dagger damage
* short blade rotation
* piercing talon stacks
* coyote auto attack
* coyote scratch
* scratch bleed
* player dodge
* dodge movement
* on-dodge instant pierce
* old dagger bleed
* stacking bleed
* cooldown ticking
* basic resources/stacks
* per-tick combat log
* victory/defeat/flee
* player death penalty
* delta output
* reward model stubs

### MVP Coyote

Coyote should have model fields for:

* level
* difficulty
* HP
* tags
* armor/resistance
* defensive capabilities
* resources, possibly empty
* loot table, possibly stubbed
* abilities

Abilities:

```text
auto_attack
scratch
```

Scratch:

* direct damage
* applies weak bleeding dot
* bleed lasts 1 tick
* 4 tick cooldown
* used round-robin / auto unless special available

### MVP Old Dagger

Weapon:

```text
piercing: [5, 10]
slashing: [2, 5]
```

Skill:

```text
short_blade
```

Rotation:

```text
slash -> slash -> piercing finisher
```

Stacks:

```text
any slashing damage grants piercing_talon
2 piercing_talon stacks enable piercing finisher
```

Piercing:

* can apply bleed
* piercing finisher can apply bleed
* dodge instant pierce can apply bleed

Bleed:

```text
max stacks: 5
1 stack: 30% piercing damage
5 stacks: 150% piercing damage
dynamic damage
source-specific
starts ticking next tick
```

On dodge:

```text
free instant pierce
does not consume piercing_talon
can generate resource
can apply bleed
applies attack_damage_down 5%
duration 3 ticks
once per tick max
internal cooldown
```

---

## 51. Data Registry Philosophy

Likely useful registries:

```text
tags.json
enemies.json
abilities.json
skills.json
weapons.json
buffs.json
debuffs.json
passives.json
actives.json
resources.json
threat_rulesets.json
balance_profiles.json
loot_tables.json
dungeons.json
encounters.json
activities.json
difficulty_profiles.json
```

Each registry should define reusable data.

Combat engine consumes the registries and produces:

```text
combat log
combat state changes
delta
```

---


## 52. XP Philosophy

After defeating an enemy or completing a combat activity, the player should receive two main XP types:

```text
Character XP
Skill XP
```

These are related but not the same.

```text
Character XP = general player progression
Skill XP = what the player actually practiced, wore, used, or contributed with
```

Combat already tracks actions, damage, buffs, debuffs, resources, equipment, and deltas. XP should use that same information rather than being a completely separate reward system.

XP should be:

* data-driven
* difficulty-aware
* level-aware
* contribution-aware
* skill-based
* explainable through the combat log and delta system
* resistant to abuse from multihit, dual wielding, or long fights

The player should gain XP for how they fought, not merely for what they own.

---

## 53. Character XP Philosophy

Character XP is awarded for defeating enemies or completing combat activities.

It represents broad progression, not specific training.

A basic formula shape:

```text
character_xp =
  enemy_character_xp
  × difficulty_magic_number
  × level_difference_xp_modifier
  × activity_modifier
```

For simple combat, this can be enemy-based.

Example:

```text
Defeat coyote
Gain character XP from coyote
```

For dungeons, raids, and special activities, character XP can come from:

```text
enemy kills
room completion
floor completion
boss kill
activity completion
```

The important part is that **difficulty magic_number must be attached to the XP formula**.

Example placeholder difficulty values:

```text
story:      0.75
normal:     1.00
hard:       1.20
nightmare:  1.50
torment:    2.00
cataclysm:  3.00
challenge:  3.50
challenge+: scaling value
```

These numbers are not final, but the model should support them.

---

## 54. Difficulty Magic Number in XP

Every combat activity or enemy context should expose a difficulty multiplier.

This should affect XP pools rather than individual skill lines directly.

Recommended structure:

```text
base XP pool
× difficulty_magic_number
= final XP pool
```

Then the final XP pool is distributed.

Example:

```text
enemy offensive skill XP pool = 100
difficulty_magic_number = 1.20

final offensive skill XP pool = 120
```

Then that 120 is distributed among skills based on contribution.

This keeps the system clean.

Difficulty modifies the value of the encounter. Contribution determines who or what receives the XP.

---

## 55. Skill XP Philosophy

Skill XP answers the question:

```text
What did the player actually use, wear, practice, or contribute with during the fight?
```

Skill XP should be based on:

* equipped gear
* used weapon skill
* used magic skill
* used defensive tools
* damage dealt
* damage taken
* damage prevented
* dots applied
* buffs used
* debuffs applied
* healing done
* resources spent
* resources generated
* procs triggered
* contribution to others’ damage

Skill XP should not be based only on what the player has equipped.

Example:

```text
Sword equipped but never used
=> little or no sword skill XP
```

```text
Focus equipped and used to cast fire spells
=> fire magic / focus-related XP
```

```text
Leather chestpiece equipped during combat
=> light armor XP based on chest slot weight
```

---

## 56. XP Pool Philosophy

To prevent abuse, combat should create finite XP pools.

Recommended pools:

```text
character_xp_pool
offensive_skill_xp_pool
defensive_skill_xp_pool
utility_skill_xp_pool
armor_skill_xp_pool
```

For MVP, this can be simplified to:

```text
character_xp_pool
weapon_skill_xp_pool
armor_skill_xp_pool
```

The reason for XP pools is to avoid bad scaling.

Bad model:

```text
Every hit gives 1 XP.
Dual wield hits twice.
Therefore dual wield gains twice as much XP.
```

Better model:

```text
Enemy has 100 offensive skill XP available.
Skills divide that 100 based on contribution.
```

This prevents abuse from:

* dual wield
* multihit
* dots
* summons
* very long fights
* intentionally low-damage farming
* spam abilities
* fast weapons

---

## 57. Character XP vs Skill XP

Character XP should usually be awarded for victory or activity completion.

Skill XP should be awarded based on participation and contribution.

Example:

```text
Player defeats coyote with old dagger.
```

Possible result:

```text
Character XP:
  +25 character XP

Skill XP:
  +18 short_blade XP
  +7 light_armor XP
```

Character XP answers:

```text
Did the player overcome the enemy/activity?
```

Skill XP answers:

```text
How did the player overcome it?
```

---

## 58. Armor XP Philosophy

Armor XP should come from the armor skills represented by equipped armor.

Armor XP should be defined by the item, not only by material.

Example:

```text
Leather chestpiece:
  armor_skill: light_armor
```

```text
Chainmail gloves:
  armor_skill: medium_armor
```

```text
Plate boots:
  armor_skill: heavy_armor
```

```text
Rags:
  armor_skill: none
```

The item definition decides the skill.

Leather usually means light armor, but the model should not rely on material alone.

---

## 59. Armor Slot Weight Philosophy

Armor XP should not be split by raw item count.

Chest matters more than gloves.

Recommended armor slot weights:

```text
head:   15%
chest:  35%
gloves: 10%
legs:   25%
boots:  15%
```

Total:

```text
100%
```

Armor XP distribution should use these weights.

This solves mixed armor builds cleanly.

---

## 60. Armor XP Formula

Basic formula:

```text
armor_skill_xp_for_skill =
  armor_xp_pool
  × armor_slot_weight_share_for_skill
  × difficulty_magic_number
  × level_difference_xp_modifier
```

For MVP, combat relevance can be ignored or set to `1`.

Later, armor XP can also consider:

* damage taken
* damage prevented
* dodges
* blocks
* parries
* barriers
* absorbs
* fight duration
* enemy level
* defensive pressure

Long-term formula shape:

```text
armor_skill_xp_for_skill =
  armor_xp_pool
  × armor_slot_weight_share_for_skill
  × combat_relevance_modifier
  × difficulty_magic_number
  × level_difference_xp_modifier
```

---

## 61. Armor XP Is Not Normalized From Partial Gear

If the player wears only one real armor piece, they should not receive full armor XP.

Example:

```text
head: rags -> none
chest: leather chest -> light_armor
gloves: rags -> none
legs: rags -> none
boots: rags -> none
```

Chest weight:

```text
35%
```

Result:

```text
light_armor receives 35% of possible armor XP
remaining 65% is unassigned/lost
```

Do not normalize this to 100%.

Reason:

```text
Wearing one leather chestpiece should train light armor,
but it should not be as effective as wearing a full leather set.
```

---

## 62. Armor Scenario 1 — Rags + One Leather Chestpiece

Equipment:

```text
head: rags
chest: worn leather chestpiece
gloves: rags
legs: rags
boots: rags
```

Definitions:

```text
rags:
  armor_skill: none

worn leather chestpiece:
  armor_skill: light_armor
```

Slot weights:

```text
chest = 35%
```

Result:

```text
light_armor XP = armor_xp_pool × 0.35
```

Example:

```text
armor_xp_pool = 100
difficulty_magic_number = 1.00

light_armor XP = 35
```

Unassigned XP:

```text
65 XP is not awarded
```

Conclusion:

```text
Yes, the player receives light armor XP,
but only for the leather chestpiece’s weighted contribution.
```

---

## 63. Armor Scenario 2 — Full Leather Set

Equipment:

```text
head: leather -> light_armor
chest: leather -> light_armor
gloves: leather -> light_armor
legs: leather -> light_armor
boots: leather -> light_armor
```

Slot weight total:

```text
light_armor = 100%
```

Result:

```text
light_armor XP = armor_xp_pool × 1.00
```

Example:

```text
armor_xp_pool = 100
difficulty_magic_number = 1.00

light_armor XP = 100
```

Conclusion:

```text
Full leather set gives full light armor XP.
```

This is the cleanest and most straightforward case.

---

## 64. Armor Scenario 3 — 2 Light / 1 Medium / 2 Heavy

Mixed armor should not automatically be punished.

It should be treated as a valid build.

Reasons a player might mix armor:

* they lack better gear
* they want dodge from light pieces
* they want protection from heavy pieces
* they want a medium armor passive
* they are training multiple skills
* they are experimenting
* a future class/build may support mixed armor

Use weighted slot distribution.

Example equipment:

```text
head: light_armor   -> 15%
chest: heavy_armor  -> 35%
gloves: medium_armor -> 10%
legs: heavy_armor   -> 25%
boots: light_armor  -> 15%
```

Distribution:

```text
light_armor: 30%
medium_armor: 10%
heavy_armor: 60%
```

Result:

```text
light_armor XP = armor_xp_pool × 0.30
medium_armor XP = armor_xp_pool × 0.10
heavy_armor XP = armor_xp_pool × 0.60
```

No generic penalty.

No generic bonus.

Just honest distribution.

---

## 65. Armor Scenario 4 — 3 Light / 2 Heavy

Do not split by item count.

Do not assume:

```text
3 light / 2 heavy = 60% / 40%
```

Use slot weight.

Example A:

```text
head: light_armor  -> 15%
chest: heavy_armor -> 35%
gloves: light_armor -> 10%
legs: heavy_armor  -> 25%
boots: light_armor -> 15%
```

Distribution:

```text
light_armor = 40%
heavy_armor = 60%
```

Even though there are three light pieces and two heavy pieces, heavy gets more XP because chest and legs have higher weight.

Example B:

```text
head: heavy_armor  -> 15%
chest: light_armor -> 35%
gloves: heavy_armor -> 10%
legs: light_armor  -> 25%
boots: light_armor -> 15%
```

Distribution:

```text
light_armor = 75%
heavy_armor = 25%
```

Conclusion:

```text
Armor XP is split by slot importance, not item count.
```

---

## 66. Mixed Armor Philosophy

Mixed armor should be valid.

The base XP system should not penalize it.

Instead of hidden penalties, use visible requirements and passives.

Examples:

```text
Light Armor Mastery:
Requires 80%+ equipped armor weight as light_armor.
Gain +10% dodge.
```

```text
Heavy Armor Discipline:
Requires 80%+ equipped armor weight as heavy_armor.
Gain +15% block effectiveness.
```

```text
Skirmisher:
Requires at least 30% light_armor and 30% medium_armor.
Gain +5% dodge and +5% stamina recovery.
```

This means:

* pure armor builds are valid
* mixed armor builds are valid
* hybrid builds can be supported later
* the player is rewarded through explicit passives, not punished through hidden XP rules

---

## 67. Weapon Skill XP Philosophy

Weapon skill XP should go to the skill actually used by the weapon/ability.

The weapon provides data.

The skill receives XP.

Example:

```text
old dagger:
  weapon family: dagger
  skill: short_blade
```

Result:

```text
short_blade receives XP
```

Weapon skill XP should be based on contribution, such as:

* attacks made
* damage dealt
* abilities used
* procs triggered
* resources generated
* resources spent
* dots applied
* contribution to kill

For MVP, if the only weapon used is old dagger:

```text
short_blade receives 100% of offensive skill XP
```

---

## 68. Weapon XP Formula

Basic formula:

```text
weapon_skill_xp_for_skill =
  offensive_skill_xp_pool
  × skill_usage_share
  × difficulty_magic_number
  × level_difference_xp_modifier
```

Where:

```text
skill_usage_share = how much this skill contributed offensively
```

For MVP:

```text
skill_usage_share = 1.00
```

if only one weapon skill was used.

Later, this can be calculated from:

* damage share
* effective damage share
* dot contribution
* proc contribution
* debuff-enabled damage
* resource usage
* kill participation

---

## 69. Weapon Scenario W1 — One Dagger, No Off-Hand

Equipment:

```text
main hand: dagger
off-hand: empty
```

Definitions:

```text
dagger -> short_blade
```

Result:

```text
short_blade XP
```

Do not give automatic bonus XP for empty off-hand.

The player may eventually gain benefits from a one-handed duelist style, but that should be a passive, build rule, or style bonus.

Example future passive:

```text
Duelist:
Requires one one-handed weapon and empty off-hand.
Gain +10% dodge and +10% precision.
```

But XP should not be increased merely because the off-hand is empty.

Conclusion:

```text
One dagger = short_blade XP from actual usage.
No generic extra XP.
```

---

## 70. Dual Dagger Philosophy

Dual dagger should probably still use:

```text
short_blade
```

Do not create a separate `dual_dagger` skill unless dual wielding is meant to be an entirely separate progression path.

Better structure:

```text
short_blade = weapon skill
dual_wielding = optional style skill
```

Example:

```text
main hand dagger hit -> short_blade XP contribution
off-hand dagger hit -> short_blade XP contribution
dual wield pattern used -> possible dual_wielding XP
```

But total XP should still come from a finite XP pool.

Dual wield should not automatically double XP.

Bad:

```text
main dagger gives 100 short_blade XP
off-hand dagger gives 100 short_blade XP
total = 200 XP
```

Better:

```text
offensive_skill_xp_pool = 100

short_blade gets 100 based on total dagger contribution
optional dual_wielding gets its own style XP pool or share
```

This allows dual wield to be a different playstyle without becoming an XP exploit.

---

## 71. Weapon Scenario W2 — Sword Main Hand + Focus Off-Hand

Equipment:

```text
main hand: sword
off-hand: focus
```

This is a hybrid melee/magic setup.

Do not split XP 50/50 just because both are equipped.

XP should follow actual usage.

### Case A — Sword Only

Player only attacks with sword.

Result:

```text
sword skill receives offensive XP
focus receives little or no XP
magic receives little or no XP
```

### Case B — Sword + Spells

Player attacks with sword and casts spells through focus.

Result:

```text
sword skill receives share based on sword contribution
magic skill receives share based on spell contribution
focus-related skill may receive share if such a skill exists
```

Example:

```text
70% damage from sword
30% damage from fire spells
```

XP split:

```text
sword_skill: 70%
fire_magic: 30%
```

### Case C — Focus Passively Empowers Sword

Example:

```text
focus adds fire damage to sword attacks
```

Then XP can split by contribution:

```text
sword_skill receives physical contribution XP
fire_magic receives magical contribution XP
focus_mastery/conduit receives support XP if such a skill exists
```

Conclusion:

```text
Do not split by equipment.
Split by contribution.
```

---

## 72. Offensive XP Distribution

Offensive skill XP should be distributed by actual offensive contribution.

Examples of offensive contribution:

* direct weapon damage
* spell damage
* dot damage
* proc damage
* resource-spending attacks
* summoned damage, if attributed
* damage enabled by offensive debuffs

Simple MVP:

```text
only old dagger used
=> short_blade gets 100% offensive skill XP
```

Long-term:

```text
short_blade dealt 75% of effective damage
fire_magic dealt 25% of effective damage
=> split offensive XP 75/25
```

The system should eventually support contribution from:

```text
direct_damage
dot_damage
proc_damage
buff_enabled_damage
debuff_enabled_damage
resource_spend_damage
```

---

## 73. Defensive XP Distribution

Defensive XP should be distributed by equipped armor and defensive contribution.

MVP:

```text
armor XP comes from equipped armor slot weights
```

Later:

```text
armor XP can be modified by combat relevance
```

Combat relevance can include:

* damage taken
* damage reduced
* number of dodges
* blocks
* parries
* barriers
* absorbs
* defensive buffs used
* enemy pressure

Example:

```text
Player wore full heavy armor but never got hit.
```

Possible long-term result:

```text
heavy_armor receives reduced defensive XP due to low relevance
```

For MVP, do not require this.

Use equipped slot weights only.

---

## 74. Utility XP Philosophy

Utility XP is not required for MVP, but the model should allow it later.

Utility XP can come from:

* healing
* shielding
* buffing
* debuffing
* interrupting
* dispelling
* crowd control
* threat management
* raid mechanic handling
* contribution damage enabled

Example:

```text
Player applies armor_down.
Ally deals 120 instead of 100.
Player receives contribution credit for +20 enabled damage.
```

That contribution can eventually feed utility XP or support skill XP.

---

## 75. Contribution XP Philosophy

Combat already wants to track contribution.

XP should eventually use the same contribution breakdown.

Example:

```text
Player A applies fire weakness.
Player B casts fireball.
Fireball deals 150 instead of 100.
```

Contribution:

```text
Player B direct damage: 150
Player A enabled damage: +50 contribution
```

XP could award:

```text
Player B: fire_magic XP from direct spell damage
Player A: debuff/support XP from enabled damage
```

This is not needed for MVP, but the design should not block it.

---

## 76. XP From Buffs and Debuffs

Buffs and debuffs should be able to contribute to XP.

Examples:

```text
damage buff
armor reduction
fire weakness
attack damage down
healing received increase
resource generation buff
```

If a buff or debuff affects combat outcome, it should be eligible for contribution tracking.

Important:

```text
The direct actor still receives full credit for their action.
The support actor also receives contribution credit for what they enabled.
```

Example:

```text
Player B hits for 120.
Player A’s debuff contributed +20.

Player B gets 120 damage credit.
Player A gets +20 contribution credit.
```

This generous accounting is intentional.

---

## 77. XP and Multihit Abuse Prevention

Because combat supports:

* dual wield
* multihit
* dots
* procs
* fast weapons
* stacking bleeds

XP must not be awarded blindly per hit.

Use finite pools.

Example:

```text
Coyote offensive XP pool = 20
```

If old dagger hits many times, short blade still cannot exceed the available offensive XP pool unless some other modifier explicitly increases the pool.

This prevents:

```text
fast weapon = best XP forever
```

Fast weapons can still be good because they may kill faster, proc more, or interact with builds better, but they should not automatically create more XP from the same enemy.

---

## 78. XP and Dots

Dots should grant XP to the skill/source that applied them.

Example:

```text
short_blade piercing applies bleed
bleed deals damage
```

Result:

```text
bleed damage contributes to short_blade offensive XP
```

If the bleed is source-specific, the XP attribution should also be source-specific.

If multiple actors apply separate bleeds, each actor receives contribution for their own bleed.

---

## 79. XP and Resources

Resource usage can contribute to skill XP.

Examples:

```text
mana spent on fire spell -> fire_magic XP
rage spent on tank attack -> relevant tank/weapon skill XP
piercing_talon spent on finisher -> short_blade XP
divinity spent on holy ability -> holy/divinity skill XP
```

Resource generation can also matter later.

Examples:

```text
rage generated by being hit -> tank/defensive skill relevance
mana regenerated through equipment -> equipment/passive contribution
holy power prepared before combat -> holy skill usage
```

For MVP, resource XP does not need complex handling.

But resource events should be logged so XP formulas can use them later.

---

## 80. XP and Gear Requirements

Weapons and armor may have:

```text
requirements
item level
skill requirement
class/archetype requirement
```

But XP should mainly follow use.

Example:

```text
Old dagger belongs to short_blade.
Player uses old dagger.
Player gains short_blade XP.
```

Weapon item level may affect damage, but long-term progression should care more about skill when fighting appropriate enemies.

---

## 81. XP and Level Difference

XP should include a level-difference modifier.

This should prevent bad farming patterns.

Examples:

* high-level player farming level 1 coyotes should receive reduced XP
* low-level player fighting level 50 boss may receive weirdly high theoretical XP, but probably cannot win
* appropriate-level enemies should be the main training path

Formula placeholder:

```text
level_difference_xp_modifier =
  f(enemy_level - player_level)
```

Possible behavior:

```text
enemy much lower level -> reduced XP
enemy similar level -> normal XP
enemy moderately higher -> increased XP
enemy impossibly higher -> maybe capped
```

Exact formula is unspecified.

This is separate from the level-difference combat penalty.

Combat penalty affects survivability and damage.

XP modifier affects reward.

---

## 82. XP and Skill Difference

Skill level should matter more than player level when fighting same-level enemies.

This means XP may eventually consider:

```text
relevant_skill_level
enemy_level
enemy_training_range
```

Example:

```text
Player level 10
short_blade skill very low
fighting level 10 enemy
```

The player should still be able to train short_blade meaningfully.

Example:

```text
Player level 50
short_blade skill 1
fighting level 1 coyote
```

This should probably not be good XP forever.

Skill catchup mechanics may exist later, but they are gameplay progression, not core combat design.

---

## 83. XP Delta Philosophy

XP should be emitted through the delta system.

Combat should not directly mutate player progression.

Example delta:

```ts
{
  type: "xp_gained",
  characterXp: 25,
  skillXp: [
    {
      skill: "short_blade",
      amount: 18,
      source: "old_dagger",
      reason: "combat_usage"
    },
    {
      skill: "light_armor",
      amount: 7,
      source: "worn_leather_chestpiece",
      reason: "equipped_armor_weight"
    }
  ]
}
```

The XP delta should be explainable.

Useful fields:

```text
skill
amount
source
reason
pool
share
difficulty_magic_number
level_modifier
```

Example:

```ts
{
  skill: "light_armor",
  amount: 35,
  source: "worn_leather_chestpiece",
  reason: "armor_slot_weight",
  pool: "armor_skill_xp",
  share: 0.35,
  difficultyMagicNumber: 1.0
}
```

---

## 84. XP Combat Log Philosophy

Combat log should explain XP sources in debug/development mode.

Example:

```text
XP Summary:
Character XP: 25

Skill XP:
Short Blade +18
  Reason: old dagger used for 100% offensive contribution

Light Armor +7
  Reason: leather chestpiece represented 35% armor weight
```

For player-facing UI, this can be simplified.

Example:

```text
You gained:
+25 Character XP
+18 Short Blade XP
+7 Light Armor XP
```

Detailed breakdown can be hidden behind an expand/debug view.

---

## 85. MVP XP Rules

For the old dagger vs coyote MVP, award:

```text
character XP
short_blade XP
armor skill XP
```

No need yet for:

* utility XP
* contribution XP
* focus XP
* dual wield XP
* loot quality XP
* companion XP
* raid contribution XP

MVP formulas:

```text
character_xp =
  enemy.character_xp
  × difficulty_magic_number
  × level_difference_xp_modifier
```

```text
short_blade_xp =
  enemy.offensive_skill_xp
  × difficulty_magic_number
  × level_difference_xp_modifier
```

```text
armor_skill_xp =
  enemy.armor_skill_xp
  × armor_slot_weight_share
  × difficulty_magic_number
  × level_difference_xp_modifier
```

If no armor skill is equipped in a slot, that slot’s armor XP share is lost.

---

## 86. MVP XP Example — Old Dagger + Rags + Leather Chest vs Coyote

Player equipment:

```text
main hand: old dagger -> short_blade
off-hand: empty

head: rags -> none
chest: worn leather chestpiece -> light_armor
gloves: rags -> none
legs: rags -> none
boots: rags -> none
```

Enemy:

```text
coyote
difficulty: story
difficulty_magic_number: 0.75
character_xp: 20
offensive_skill_xp: 16
armor_skill_xp: 12
```

Armor distribution:

```text
light_armor = 35%
none = 65%
```

Result:

```text
character_xp = 20 × 0.75 = 15

short_blade_xp = 16 × 0.75 = 12

light_armor_xp = 12 × 0.35 × 0.75 = 3.15
```

Since XP should probably be integer:

```text
light_armor_xp = 3
```

or use hidden fractional XP internally.

Recommended:

```text
store fractional XP internally if possible
display rounded XP to player
```

---

## 87. MVP XP Example — Old Dagger + Full Leather vs Coyote

Player equipment:

```text
main hand: old dagger -> short_blade

head: leather -> light_armor
chest: leather -> light_armor
gloves: leather -> light_armor
legs: leather -> light_armor
boots: leather -> light_armor
```

Armor distribution:

```text
light_armor = 100%
```

Enemy values:

```text
character_xp: 20
offensive_skill_xp: 16
armor_skill_xp: 12
difficulty_magic_number: 0.75
```

Result:

```text
character_xp = 15
short_blade_xp = 12
light_armor_xp = 12 × 1.00 × 0.75 = 9
```

Conclusion:

```text
Full leather trains light armor better than one leather chestpiece.
```

---

## 88. MVP XP Example — Mixed Armor vs Coyote

Player equipment:

```text
head: light_armor   -> 15%
chest: heavy_armor  -> 35%
gloves: medium_armor -> 10%
legs: heavy_armor   -> 25%
boots: light_armor  -> 15%
```

Distribution:

```text
light_armor = 30%
medium_armor = 10%
heavy_armor = 60%
```

Enemy armor XP pool after difficulty:

```text
armor_skill_xp = 12
difficulty_magic_number = 0.75

final armor XP pool = 9
```

Result:

```text
light_armor XP = 9 × 0.30 = 2.7
medium_armor XP = 9 × 0.10 = 0.9
heavy_armor XP = 9 × 0.60 = 5.4
```

Possible stored values:

```text
light_armor +2.7
medium_armor +0.9
heavy_armor +5.4
```

Possible displayed values:

```text
Light Armor +3
Medium Armor +1
Heavy Armor +5
```

Conclusion:

```text
Mixed armor splits XP by weighted slot contribution.
```

---

## 89. MVP XP Example — One Dagger, No Off-Hand

Player equipment:

```text
main hand: old dagger -> short_blade
off-hand: empty
```

Combat usage:

```text
100% offensive contribution from old dagger / short_blade
```

Result:

```text
short_blade receives 100% offensive skill XP
```

No extra XP for empty off-hand.

Example:

```text
offensive_skill_xp_pool after modifiers = 12
short_blade XP = 12
```

Conclusion:

```text
Empty off-hand may matter for playstyle, passives, or abilities,
but not as a generic XP bonus.
```

---

## 90. Future XP Example — Dual Dagger

Player equipment:

```text
main hand: dagger -> short_blade
off-hand: dagger -> short_blade
```

Combat usage:

```text
main hand attacks
off-hand attacks
dual wield pattern triggers
```

Recommended result:

```text
short_blade receives offensive XP based on dagger contribution
optional dual_wielding receives style XP if such a skill exists
```

But offensive XP pool is capped.

Example:

```text
offensive_skill_xp_pool = 100

short_blade contribution = 100%
short_blade XP = 100
```

Not:

```text
main hand dagger XP = 100
off-hand dagger XP = 100
total = 200
```

If dual wielding has separate style XP:

```text
dual_wielding XP comes from a style/utility pool
or from a small separate style reward
```

Conclusion:

```text
Dual wield changes playstyle, not total XP abuse.
```

---

## 91. Future XP Example — Sword + Focus

Player equipment:

```text
main hand: sword -> sword_skill
off-hand: focus -> magic conduit
```

### If only sword attacks are used:

```text
sword_skill receives offensive XP
focus receives no meaningful XP
magic receives no meaningful XP
```

### If sword attacks and fire spells are used:

Example contribution:

```text
sword physical damage: 70%
fire spell damage: 30%
```

XP split:

```text
sword_skill = 70% offensive XP
fire_magic = 30% offensive XP
```

### If focus adds fire damage to sword attacks:

Example attack:

```text
70 physical sword damage
30 fire focus damage
```

XP split:

```text
sword_skill receives physical contribution
fire_magic or focus_mastery receives magical contribution
```

Conclusion:

```text
XP follows actual contribution, not equipment presence.
```

---

## 92. XP Rounding Philosophy

Combat can calculate fractional XP.

Recommended:

```text
store fractional XP internally
display rounded XP externally
```

This prevents small contributions from being lost forever.

Example:

```text
medium_armor gains 0.9 XP
```

If rounded down every time, medium armor may never progress in small fights.

Better:

```text
internal medium_armor XP += 0.9
display: +1 Medium Armor XP
```

or:

```text
display only whole values, but preserve decimal internally
```

---

## 93. XP Source Transparency

The player should eventually understand why they received XP.

Good XP explanations:

```text
Short Blade XP gained because you used Old Dagger.
Light Armor XP gained because 35% of your armor weight was Light Armor.
Heavy Armor XP gained because 60% of your armor weight was Heavy Armor.
Fire Magic XP gained because 30% of your damage came from fire spells.
```

Bad XP explanations:

```text
You gained random skill XP.
```

Transparency matters because the system supports complex builds.

---

## 94. XP and Build Freedom

The XP system should support experimentation.

It should not silently punish unusual builds.

Valid builds may include:

* full light armor
* full heavy armor
* light/heavy hybrid
* sword and focus
* dagger with empty off-hand
* dual dagger
* magic weapon hybrid
* dodge build
* block build
* barrier build
* resource build

The XP system should simply observe what the player used and distribute XP accordingly.

Specialization rewards should come from explicit passives, not hidden XP penalties.

---

## 95. XP Expansion Summary

```text
Character XP:
  Awarded for defeating enemies or completing activities.
  Modified by difficulty magic_number and level difference.

Skill XP:
  Awarded based on use, equipment, and contribution.

Armor XP:
  Split by weighted armor slots.
  Partial gear gives partial XP.
  Mixed gear splits XP.
  No generic mixed-armor penalty.

Weapon XP:
  Goes to the skill actually used.
  One dagger gives short_blade XP.
  Dual dagger still primarily gives short_blade XP.
  Optional dual_wielding can exist as style skill.

Hybrid XP:
  Sword + focus splits only if both contribute.
  Do not split XP just because equipment is worn.

XP Pools:
  Enemy/activity creates finite XP pools.
  Contribution divides the pools.
  Prevents multihit and dual-wield abuse.

Difficulty:
  difficulty_magic_number applies to XP pools.

Delta:
  XP is emitted through combat delta.

Scenarios:
  Used as explainable examples for armor, weapon, and hybrid XP behavior.
```

## 121. Rotation Runtime Philosophy

Rotations should not be treated as one static list stored directly on the player.

Instead, the game should **compile a runtime rotation** from the player’s current loadout.

```text id="m51qic"
equipped gear
+ skills
+ weapon types
+ off-hand setup
+ passives
+ buffs
+ legendary effects
+ rotation profile
= compiled runtime rotation
```

This compiled rotation should be visible to the player.

Example UI concept:

```text id="8vcdzc"
With this loadout, your current rotation is:

1. Apply Weak Opening
2. Slashing Cut
3. Slashing Cut
4. Piercing Finisher
5. Barrage of Stabs when ready
6. Auto Attack if no ability is available
```

This is important because combat is auto-resolved. The player needs to understand what their build will actually do before pressing start.

---

## 122. Rotation Runtime as Player Readability Tool

The compiled rotation should be explainable.

The UI should show:

* default skill rotation
* added abilities
* replaced abilities
* legendary modifications
* off-hand changes
* style changes
* profile behavior
* cooldown-based exceptions
* resource spenders
* interrupt behavior
* fallback auto attack

Example:

```text id="mkjqo8"
Base Short Blade Rotation:
Slash -> Slash -> Piercing Finisher

Modified by Legendary Dagger:
Piercing Finisher replaced by Crimson Needle

Added Legendary Ultimate:
After 3 finishers, use Barrage of Stabs

Final Runtime Rotation:
Slash -> Slash -> Crimson Needle
After 3 Crimson Needles: Barrage of Stabs
```

The player should not need to guess.

---

## 123. Rotation Types

The system likely needs all three major rotation styles:

```text id="asrsgc"
fixed sequence
priority rotation
timeline rotation
```

### Fixed Sequence

Good for simple skills and MVP.

Example:

```text id="kgzaqk"
Slash
Slash
Pierce
Repeat
```

### Priority Rotation

Good for advanced builds, cooldowns, resources, procs, and supports.

Example:

```text id="52wbqb"
if barrage_ready: Barrage of Stabs
if piercing_talon >= 2: Piercing Finisher
else: Slashing Cut
```

### Timeline Rotation

Good for bosses, scripted mechanics, and maybe some special player builds later.

Example:

```text id="6tnyow"
Tick 1: Fire Breath
Tick 4: Summon Minion
Tick 8: Tank Buster
Tick 12: Stance Swap
Repeat
```

The runtime compiler can combine these.

A skill may start as a fixed sequence, then gain priority layers from gear or legendary effects.

---

## 124. Custom Rotation Philosophy

Custom rotations should probably be allowed eventually.

Not required for MVP.

The question is not whether custom rotations are possible, but how much control the player should eventually have.

Potential future options:

```text id="fsb8yy"
preset only
preset + small customization
full custom priority list
full scripting-like rotation builder
```

For now, use preset rotation profiles and compiled previews.

Later, custom rotation can allow players to reorder or configure:

* ability priority
* buff timing
* heal thresholds
* defensive usage
* resource spenders
* proc consumption
* movement preferences
* boss mechanic responses

MVP should not need this.

---

## 125. Rotation Profiles

Rotation profiles are named behavior presets.

They answer:

```text id="hx0sie"
How should this actor use its available rotation tools?
```

Examples:

```text id="ksy5i6"
default
aggressive
safe
resource_saving
bossing
first_fit
best_fit
frontload
backload
minimum
```

A skill can have multiple profiles.

The player or NPC can use a profile to define how the rotation behaves without manually editing every action.

This is especially useful because combat is auto-resolved.

---

## 126. Skill Rotations and Profiles

A skill may define a default rotation and optional profiles.

Example short blade:

```text id="9hgt9v"
short_blade:
  default:
    Slash -> Slash -> Pierce

  aggressive:
    consume piercing_talon as soon as possible
    use cooldowns immediately

  bleed_focus:
    prioritize maintaining bleed
    delay finisher if bleed is about to fall off

  safe:
    prefer dodge-enhancing abilities if available
```

This lets the same skill support multiple playstyles.

---

## 127. Legendary Rotation Modification

Legendary effects can:

* add rotation steps
* add procs
* add finishers
* replace existing abilities
* modify ability conditions
* modify resource generation
* modify cooldowns
* add ultimate-style abilities
* change rotation profile behavior

Replacement must be visible.

Example:

```text id="j9cwka"
Base:
Piercing Finisher

Legendary replacement:
Piercing Finisher -> Crimson Needle
```

The player should see this clearly in the compiled runtime rotation.

---

## 128. Legendary Helper JSON Philosophy

Legendary items should not require the engine to guess how they modify rotations.

There should be helper data that says exactly what the legendary does.

Example concept:

```json id="fngnq6"
{
  "legendary_id": "needle_choir",
  "rotation_modifiers": [
    {
      "type": "add_ability",
      "ability": "barrage_of_stabs",
      "condition": "after_3_piercing_finishers",
      "placement": "high_priority"
    }
  ]
}
```

Replacement example:

```json id="o3iwhz"
{
  "legendary_id": "crimson_fang",
  "rotation_modifiers": [
    {
      "type": "replace_ability",
      "from": "piercing_finisher",
      "to": "crimson_needle",
      "display": "Piercing Finisher replaced by Crimson Needle"
    }
  ]
}
```

This keeps legendary design controlled and explainable.

---

## 129. Rotation Compiler Philosophy

The rotation compiler should take the loadout and produce a final runtime rotation.

Inputs:

```text id="4pzb78"
equipped weapons
equipped armor
equipped accessories
active skills
weapon style
off-hand style
legendary effects
passives
rotation profile
activity context
```

Output:

```text id="1fjx4n"
compiled rotation
display rotation
runtime action rules
debug explanation
```

Example output:

```text id="0yj5hh"
Final Rotation:
1. If Barrage Ready: Barrage of Stabs
2. If Piercing Talon >= 2: Crimson Needle
3. Slashing Cut
4. Slashing Cut
5. Auto Attack fallback

Modifications:
- Old Dagger provides Short Blade damage profile.
- Crimson Fang replaces Piercing Finisher.
- Needle Choir adds Barrage of Stabs.
- Aggressive profile uses finishers immediately.
```

---

## 130. Support Rotation Correction

Support characters should not treat buffs and heals as free extras in the same way damage dealers do.

For supports, buffs and heals are often their “attacks.”

In other words:

```text id="m2vnve"
For damage dealer:
  attack is the main action
  buffs/heals/defensives may be extra actions

For support:
  buff/heal/control may be the main contribution action
```

This means support rotation should be profile-driven.

A healer should not always heal blindly.

A buffer should not always dump buffs randomly.

They need behavior profiles.

---

## 131. Healer Profile Philosophy

Healers need profiles that define when they heal and what they do during downtime.

Example healer profiles:

```text id="bzrgqy"
first_fit
best_fit
aggressive_healer
minimum
safe_healer
mana_saving
```

### First Fit

Uses the first valid heal when a target meets the threshold.

Example:

```text id="4svng7"
if ally HP < 80%:
  use first available heal
else:
  damage
```

Simple and predictable.

### Best Fit

Chooses the most appropriate heal for the situation.

Example:

```text id="hlwdfv"
if ally HP < 30%:
  use big heal
else if ally HP < 70%:
  use efficient heal
else:
  damage
```

Better but more complex.

### Aggressive Healer

Heals often and early.

Example:

```text id="jaowvz"
if ally HP < 90%:
  heal
else:
  damage
```

Safer, but may waste mana.

### Minimum Healer

Maximizes damage and only heals late.

Example:

```text id="pm7nj9"
if ally HP < 35%:
  heal
else:
  damage
```

Higher risk, better damage uptime.

### Mana Saving

Uses cheap heals first, avoids overhealing.

Example:

```text id="jgdtbs"
if ally HP < 70% and cheap heal available:
  cheap heal
if ally HP < 35% and big heal available:
  big heal
else:
  damage or mana recovery
```

---

## 132. Healer Downtime Damage

Healers should contribute some damage during downtime.

If no healing is needed, healer rotation should fall back to:

* weak attack
* wand attack
* minor spell
* mana recovery action
* debuff
* buff maintenance

Example:

```text id="evxevi"
if healing_needed:
  heal
else if buff_missing:
  apply buff
else:
  minor holy bolt
```

This prevents healers from doing nothing when no one needs healing.

---

## 133. Healing Profile Example

Example healer skill:

```text id="igrn88"
restoration_magic
```

Abilities:

```text id="kdi6vv"
Mend:
  small heal
  low mana cost

Greater Mend:
  large heal
  high mana cost

Renew:
  heal over time

Holy Bolt:
  minor damage

Meditate:
  recover mana if allowed
```

Profile: `best_fit`

```text id="yr3wpy"
if target HP < 30% and Greater Mend available:
  Greater Mend

else if target HP < 70% and Mend available:
  Mend

else if Renew missing and target HP < 90%:
  Renew

else:
  Holy Bolt
```

Profile: `minimum`

```text id="wpq1k5"
if target HP < 35% and Greater Mend available:
  Greater Mend

else if target HP < 50% and Mend available:
  Mend

else:
  Holy Bolt
```

---

## 134. Buff Profile Philosophy

Buffers also need profiles.

Buffs should not simply be used randomly.

A buff profile controls timing and ordering.

Examples:

```text id="yccb97"
frontload
backload
maintain
burst_window
efficient
```

### Frontload

Uses strong buffs early.

Good for short fights.

```text id="bv2fiu"
big buff first
then smaller buffs
then attack/support
```

### Backload

Uses weaker/longer buffs first, then short powerful buffs.

Good for setting up a burst window.

```text id="qkugzv"
long weak buff
medium buff
short powerful buff
burst action
```

This matches your example:

```text id="15p0r7"
10-tick weak buff first
then 3-tick big buff
```

### Maintain

Keeps buffs active efficiently.

```text id="7ykdav"
refresh long buff before it falls
use short buff only during damage windows
```

### Burst Window

Saves buffs until a condition.

```text id="27ww8e"
if boss vulnerable:
  use big buff
else:
  maintain minor buffs
```

---

## 135. Buff Rotation Example

Support skill:

```text id="6j766a"
battle_chant
```

Abilities:

```text id="amvhi2"
Steady Rhythm:
  weak damage buff
  duration 10 ticks

War Chorus:
  medium damage buff
  duration 6 ticks

Crescendo:
  strong damage buff
  duration 3 ticks

Minor Strike:
  fallback damage
```

Profile: `backload`

```text id="qs2n3z"
Tick 1: Steady Rhythm
Tick 2: War Chorus
Tick 3: Crescendo
Tick 4: Minor Strike or contribution action
```

Reason:

```text id="t93n90"
Long weak buff first.
Short powerful buff last.
All buffs overlap during the burst window.
```

Profile: `frontload`

```text id="u83so4"
Tick 1: Crescendo
Tick 2: War Chorus
Tick 3: Steady Rhythm
Tick 4: Minor Strike
```

Reason:

```text id="snyspc"
Immediate power, less efficient overlap.
Good for short fights.
```

---

## 136. Controller Profile Philosophy

Controllers need profiles too.

A controller can focus on:

```text id="elfozw"
interrupts
slows
damage reduction
random targeting/confusion
boss mechanic prevention
crowd control
```

Example profiles:

```text id="nlrmk1"
lockdown
damage_reduction
interrupt_focus
chaos
bossing
```

### Lockdown

Prevent enemy actions.

```text id="plmdfx"
if cast can be prevented: silence/lockdown
else if enemy can be slowed: slow
else damage
```

### Damage Reduction

Reduce incoming pressure.

```text id="8hg30p"
apply attack_damage_down
apply slow
apply weakness
fallback damage
```

### Chaos

Creates disruptive random effects.

```text id="cwbqcu"
confusion
disorient
random target effects
```

---

## 137. Barrier Healer Profile Philosophy

Barrier healers need different profiles from HP healers.

They care about preventing damage before it happens.

Profiles:

```text id="o5v0tc"
predictive
reactive_barrier
efficient_barrier
burst_protection
```

### Predictive

Applies barrier before expected damage.

Good for boss timelines.

```text id="e1afwe"
if big mechanic in next 2 ticks:
  apply barrier
else damage/support
```

### Reactive Barrier

Applies barrier after damage or when HP is lower.

```text id="va2ac6"
if ally HP < 70%:
  apply barrier
else damage
```

### Efficient Barrier

Avoids wasting barriers.

```text id="js0ivu"
if no active barrier and incoming damage expected:
  apply barrier
else minor damage
```

---

## 138. Dual-Wield Style Philosophy

Dual-wielding should be its own style layer.

It can be shared across one-handed weapons.

Example:

```text id="sl73g7"
dual_wielding:
  applies when main hand and off-hand are valid weapons
```

It should not be completely different for every weapon pair.

Instead:

```text id="f8xanh"
short_blade defines dagger behavior
sword defines sword behavior
dual_wielding defines off-hand behavior/style rules
```

Examples:

```text id="5zlj2e"
dual daggers:
  short_blade + dual_wielding

dual swords:
  sword_skill + dual_wielding

sword + dagger:
  sword_skill + short_blade + dual_wielding
```

This lets dual-wielding share legendaries and style rules.

---

## 139. Dual-Wield Legendary Sharing

Dual-wield legendaries should be able to affect the style layer rather than one weapon only.

Example:

```text id="v65avw"
Legendary Gloves: Twin Rhythm

Effect:
When dual-wielding any two one-handed weapons,
every 4th off-hand hit repeats at 50% damage.
```

This can apply to:

* dual daggers
* dual swords
* sword + dagger
* axe + mace

Weapon-specific legendaries can still exist.

Example:

```text id="0k0gex"
Legendary Dagger Pair:
Bleed stacks faster when both weapons are daggers.
```

---

## 140. Rotation Profiles as the Main Answer

The recurring answer to many questions is:

```text id="kh2f22"
rotation profiles
```

Profiles solve:

* healer behavior
* buffer behavior
* controller behavior
* aggressive vs safe damage
* resource saving
* bossing
* burst windows
* minimum healing
* custom rotation later

So the system should support:

```text id="fb6e0g"
skill default rotation
+ role profile
+ build profile
+ item modifiers
+ legendary modifiers
= compiled runtime rotation
```

This keeps the system flexible without needing full custom rotation in MVP.

---

## 141. Preset Profiles Before Custom Rotation

For MVP and early development:

```text id="km6hwp"
do not build full custom rotation editor
```

Instead:

* define good preset profiles
* compile runtime rotation
* show the player what will happen
* allow profile selection later

Examples:

```text id="dfe9n1"
default
aggressive
safe
first_fit
best_fit
frontload
backload
minimum
bossing
resource_saving
```

Custom rotation can come later.

---

## 142. Future Custom Rotation

Custom rotation can eventually allow the player to tune behavior.

Potential custom options:

* reorder ability priorities
* set heal thresholds
* choose buff timing
* choose defensive timing
* choose whether to save or spend resources
* choose movement preferences
* choose bossing behavior
* choose interrupt rules

Example custom healer rule:

```text id="u0sxz7"
If ally HP < 45%:
  use Greater Mend
else if ally HP < 80%:
  use Renew
else:
  Holy Bolt
```

Example custom buff rule:

```text id="0qoicw"
Use Crescendo only if Steady Rhythm and War Chorus are both active.
```

This is powerful, but not needed for MVP.

---

## 143. Rotation Compiler Example — Short Blade With Legendary

Loadout:

```text id="j6vlba"
main hand: old dagger
off-hand: empty
skill: short_blade
profile: default
legendary: Needle Choir
```

Base rotation:

```text id="vj21id"
Slash
Slash
Piercing Finisher
```

Legendary modifier:

```text id="nk5bcf"
After 3 Piercing Finishers:
  add Barrage of Stabs
```

Compiled rotation:

```text id="6xgkce"
1. If Barrage Ready: Barrage of Stabs
2. If piercing_talon >= 2: Piercing Finisher
3. Slashing Cut
4. Slashing Cut
5. Auto Attack fallback
```

Display explanation:

```text id="lprevg"
Needle Choir adds Barrage of Stabs after 3 Piercing Finishers.
```

---

## 144. Rotation Compiler Example — Healer Profile

Loadout:

```text id="6ev520"
skill: restoration_magic
profile: minimum
weapon: focus
```

Abilities:

```text id="30opjh"
Greater Mend
Mend
Renew
Holy Bolt
```

Compiled rotation:

```text id="lgigbp"
1. If target HP < 35% and Greater Mend available: Greater Mend
2. If target HP < 50% and Mend available: Mend
3. If Renew missing and target HP < 70%: Renew
4. Otherwise: Holy Bolt
```

Display explanation:

```text id="ons8l9"
Minimum healer profile delays healing to maximize damage uptime.
```

---

## 145. Rotation Compiler Example — Buffer Backload

Loadout:

```text id="37j6if"
skill: battle_chant
profile: backload
```

Buffs:

```text id="25pqvn"
Steady Rhythm: weak, 10 ticks
War Chorus: medium, 6 ticks
Crescendo: strong, 3 ticks
```

Compiled rotation:

```text id="lsplae"
1. Apply Steady Rhythm
2. Apply War Chorus
3. Apply Crescendo
4. Attack or support action
```

Display explanation:

```text id="77e195"
Backload applies longer buffs first and the strongest short buff last, creating overlap during the burst window.
```

---

## 146. Rotation Compiler Example — Sword + Focus Hybrid

Loadout:

```text id="pwb5mq"
main hand: sword
off-hand: focus
skill: sword
secondary: fire_magic
profile: spellblade_default
```

Compiled rotation:

```text id="olws85"
1. Sword Strike to generate focus_charge
2. Sword Strike to generate focus_charge
3. Elemental Weave if focus_charge >= 2
4. Spellblade Cut
5. Auto Attack fallback
```

Display explanation:

```text id="gktglx"
Sword attacks generate focus_charge. Focus spends it to add fire damage through Spellblade Cut.
```

---

## 147. Runtime Rotation Display

The player-facing rotation preview should show:

```text id="f3d5rn"
main rotation
extra actions
procs
legendary changes
fallback behavior
profile explanation
```

Example:

```text id="i7a2nv"
Current Rotation: Short Blade / Needle Choir

Main:
1. Slashing Cut
2. Slashing Cut
3. Piercing Finisher

Proc:
- On Dodge: Instant Pierce

Legendary:
- After 3 Piercing Finishers: Barrage of Stabs

Fallback:
- Auto Attack

Profile:
- Default: spend Piercing Talon as soon as finisher is ready
```

---

## 148. Rotation Expansion Summary

```text id="g635gm"
Rotations are compiled at runtime from loadout.
Skills provide base rotations.
Profiles modify behavior.
Legendary effects can add or replace rotation pieces.
Replacements must be visible.
Helper JSON should define legendary modifications explicitly.
Support rotations need profiles because buffs/heals may be their main actions.
Healers need profiles for thresholds and downtime damage.
Buffers need profiles for timing, especially frontload/backload behavior.
Controllers and barrier healers need their own profiles.
Dual-wielding should be a shared style layer.
Preset profiles come before full custom rotation.
Custom rotation can come later.
The player should see the final compiled rotation before combat.
```
## 149. Item Level vs. Level Requirement Philosophy

Item level and player level requirement should be separate concepts.

```text
item_level = stat/content tier
level_requirement = who can equip/use it
```

This allows gear progression to be more granular.

An item can have:

```text
item_level
level_requirement
skill_requirement
class/archetype_requirement
stat_baseline
special_modifiers
conditional_passives
power_window
```

This separates:

* whether the player can equip the item
* how strong the item’s numbers are
* what combat tier the item belongs to
* whether the item has special conditional effects

---

## 150. Item Level as Stat Baseline

Item level should define the baseline numerical strength of gear.

For weapons, item level can affect:

```text
damage interval
stat modifiers
resource generation
proc strength
cooldown values
special effect potency
```

Example:

```text
Old Dagger
item_level: 1
piercing: [5, 10]
slashing: [2, 5]
```

```text
Sharpened Dagger
item_level: 3
piercing: [9, 16]
slashing: [4, 8]
```

The skill still defines the rotation.

The item defines stronger numbers and possible exceptions.

---

## 151. Item Level and Extra Bonuses

Higher item level can unlock extra item bonuses.

Example:

```text
item_level 1:
  basic damage intervals

item_level 3:
  basic damage intervals
  + one extra modifier

item_level 5:
  stronger intervals
  + stronger modifier
  + possible special passive
```

Example dagger:

```text
Serrated Dagger
item_level: 3

modifier:
  bleeding_effects_dealt_by_this_weapon +10%
```

This fits the existing weapon philosophy:

```text
weapon = damage profile, modifiers, special item exceptions
skill = rotation and behavior
```

So the short blade skill still defines bleed behavior, but the item can modify it.

---

## 152. Level Requirement

Level requirement controls access.

Example:

```text
Dodge Ring
required_level: 10
```

This means the player cannot use it before level 10.

But the ring’s combat power may also depend on a level window.

That is separate.

---

## 153. Power Window Items

Some items should be strongest within a specific level range.

Example:

```text
Ring of Dodge
required_level: 10
power_window: level 10-14

effect:
  +12% dodge while player level is between 10 and 14
```

Outside the power window, the item can:

* stop working
* weaken
* become a smaller bonus
* still provide secondary stats
* become mostly obsolete

Example:

```text
level 10-14:
  +12% dodge

level 15+:
  +3% dodge
```

or:

```text
level 15+:
  power_window_expired = true
  bonus disabled
```

This keeps mid-level gear tactically interesting without letting it dominate forever.

---

## 154. Conditional Equipment Passives

Equipment can provide conditional passives.

Examples:

```text
+12% dodge while player level is 10-14
+10% bleed damage if using short_blade
+5% fire resistance in fire dungeons
+1 mana per tick if wielding a focus
+15% barrier strength if wearing cloth chest
```

These passives should use the same passive system as class, NPC, food, and external buffs.

Item passives should be visible in the compiled loadout and rotation preview when relevant.

---

## 155. Power Window Impact on Rotation

Power window items can change the effective rotation.

Example:

```text
Ring of Dodge
+12% dodge at level 10-14
```

Since dodge:

* negates damage
* adds +1 range
* triggers on-dodge instant pierce for short blade

This ring can make a short blade dodge build much stronger during that level range.

The compiled rotation preview should show this.

Example:

```text
Current Loadout Impact:
Ring of Dodge increases dodge chance by 12%.
Your Short Blade on-dodge Instant Pierce will trigger more often.
```

This helps the player understand why the item matters.

---

## 156. Item Requirement Types

Items can require more than player level.

Possible requirements:

```text
player level
skill level
class/archetype
weapon style
armor weight
activity unlock
quest unlock
faction unlock
stat minimum
```

Examples:

```text
Parrying Dagger:
  requires short_blade skill 5
  enables parry
```

```text
Knight Plate:
  requires heavy_armor skill 10
  requires level 12
```

```text
Ash Focus:
  requires fire_magic skill 8
```

Requirements should block use or reduce effectiveness depending on item type.

For MVP, simple equip requirements are enough.

---

## 157. Item Requirements and Auto-Resolver

Item requirements matter for the auto-resolver because the resolver needs to know whether an actor can actually answer a mechanic.

Example:

```text
Boss mechanic:
  fire_breath
  tags: fire_damage, magic_damage, tank_damage

Candidate actor:
  golem_friend
  tags: immune_fire
```

Resolver result:

```text
assign golem_friend
```

But if a mechanic requires interrupt:

```text
Boss mechanic:
  interruptable_cast
```

The resolver must check:

```text
Does assigned actor have an interrupt ability?
Is it off cooldown?
Is the required weapon equipped?
Does the actor meet item/skill requirements?
```

So item requirements affect mechanic eligibility.

---

# Boss / Raid Auto-Resolver

## 158. Auto-Resolver Philosophy

Bosses and raids can have many tags.

A boss may have 50+ tags.

The player should not be forced to manually parse all of them every time.

Instead, the game should surface the **most pressing mechanics** and use an auto-resolver to suggest or apply assignments.

The auto-resolver answers:

```text
Who should handle this mechanic?
How should they handle it?
Is the current party capable of resolving it?
What happens if nobody is assigned?
```

The goal is to reduce cognitive overload while preserving player agency.

---

## 159. Pressing Mechanics vs. Passive Tags

Not all tags deserve equal attention.

A boss may have tags like:

```text
boss
dragon
fire_aligned
flying
ancient
magic_damage
immune_fire
resistant_slashing
summon_minion
fire_breath
tail_sweep
tank_buster
interruptable
```

The UI should not show all of these as equally urgent.

Instead, tags should be categorized.

### Passive / informational tags

```text
dragon
ancient
fire_aligned
boss
immune_fire
resistant_slashing
```

### Pressing / reactive mechanic tags

```text
fire_breath
tank_buster
summon_minion
interruptable_cast
spread_damage
stack_damage
floor_fire
mind_control
```

The auto-resolver should prioritize pressing mechanic tags.

---

## 160. Mechanic Definition

A boss mechanic should be a structured object, not just a tag.

Example:

```text
Fire Breath:
  tags:
    fire_damage
    magic_damage
    tank_damage

  severity:
    high

  default_resolution:
    tank_cooldown

  possible_counters:
    immune_fire
    high_fire_resistance
    magic_barrier
    tank_defensive
    spell_tank

  failure_result:
    heavy_party_damage
```

This allows the resolver to reason about it.

---

## 161. Mechanic Display Philosophy

The player should see mechanics in a simplified, actionable way.

Example display:

```text
Fire Breath
Type: Fire / Magic / Tank Damage
Default Plan: Assign tank with defensive cooldown
Alternative: Assign fire-immune ally
```

Instead of showing:

```text
fire_breath, fire_damage, magic_damage, tank_damage, cone_attack, periodic_breath, high_severity
```

The game can still expose full tags in an advanced/debug view.

---

## 162. Auto-Resolver Assignment Philosophy

The auto-resolver should assign actors to mechanics based on:

```text
immunity
resistance
role
available cooldowns
ability tags
item requirements
skill requirements
current health
resource availability
range
existing assignment
player-defined profile
```

Example:

```text
Fire Breath
```

Default resolver:

```text
assign tank
use Rampart
```

Player override:

```text
assign fire-immune friend
```

Result:

```text
fire-immune friend handles Fire Breath
no tank cooldown needed
```

The auto-resolver should not remove player creativity. It should provide a baseline and let the player override it.

---

## 163. Default Auto-Resolver

A default resolver can use common RPG assumptions.

Examples:

```text
tank_damage -> assign tank
magic_damage -> assign spell-resistant actor if available
fire_damage -> prefer fire immune/resistant actor
interruptable -> assign actor with interrupt
summon_minion -> assign DPS/controller
raidwide_damage -> assign healer/barrier healer
spread_damage -> assign everyone separately
stack_damage -> group assigned actors
debuff_cleanse -> assign cleanser
```

This gives new players a functional baseline.

---

## 164. Player-Created Resolver Profiles

Players should be able to create resolver profiles.

Example:

```text
Fire Chasm Dungeon Profile:
  all fire_damage mechanics -> assign golem_friend if available
  interruptable casts -> assign bruiser
  summon_minion -> assign dagger_dps
  raidwide_damage -> assign barrier_healer
```

This lets the player encode their strategy once and reuse it.

Your example:

```text
Fire Chasm dungeon:
Here is an auto-resolver profile that assigns all fire damage taken to my friend who is immune to fire.
I made it.
```

This is exactly the kind of player-authored strategy the system should support.

---

## 165. Resolver Profile Scope

A resolver profile can be scoped to:

```text
global
activity type
dungeon
boss
party composition
damage type
role setup
specific companion
```

Examples:

```text
Global:
  interruptable casts -> use first available interrupt

Fire Chasm:
  fire_damage -> assign golem_friend

Dragon Bosses:
  fire_breath -> assign fire immune actor

Solo:
  assign player to all mechanics
```

This keeps profiles reusable.

---

## 166. Resolver Profile Example — Fire Chasm

```text
profile: Fire Chasm Safety

rules:
  - if mechanic has fire_damage:
      assign: golem_friend
      reason: immune_fire

  - if mechanic has interruptable:
      assign: hammer_bruiser
      reason: has_interrupt

  - if mechanic has summon_minion:
      assign: dagger_dps
      reason: high_single_target_damage

  - if mechanic has raidwide_damage:
      assign: barrier_healer
      reason: party_absorb
```

Player-facing display:

```text
Fire Chasm Safety Profile

Fire Damage:
  handled by Golem Friend because they are immune to fire.

Interrupts:
  handled by Hammer Bruiser.

Minions:
  handled by Dagger DPS.

Raidwide Damage:
  handled by Barrier Healer.
```

---

## 167. Resolver Rule Structure

A resolver rule can look like:

```text
if mechanic has tag X
and actor has tag Y
and actor ability/cooldown is available
then assign actor
with action Z
```

Example:

```text
if mechanic has fire_damage
and actor has immune_fire
then assign actor
```

More advanced:

```text
if mechanic has tank_damage
and actor role is tank
and actor has defensive cooldown available
then assign actor
and use best defensive
```

Possible fields:

```text
mechanic_tags
required_actor_tags
preferred_actor_tags
forbidden_actor_tags
required_abilities
preferred_abilities
minimum_resistance
minimum_health
resource_requirement
cooldown_requirement
assignment_priority
fallback_rule
```

---

## 168. Resolver Result

The resolver should output something like:

```text
mechanic: Fire Breath
assigned_actor: Golem Friend
resolution: immune_fire
confidence: high
expected_result: no fire damage taken
```

Or:

```text
mechanic: Fire Breath
assigned_actor: Tank
resolution: Rampart
confidence: medium
expected_result: reduced fire damage
risk: tank may still take heavy damage
```

Or:

```text
mechanic: Fire Breath
assigned_actor: none
resolution: unresolved
confidence: failed
expected_result: heavy damage / likely death
```

This should be visible to the player.

---

## 169. Resolver Confidence

Auto-resolver should have confidence levels.

Example:

```text
high
medium
low
failed
```

High confidence:

```text
immune_fire assigned to fire_damage
```

Medium confidence:

```text
tank uses 15% reduction against fire breath
```

Low confidence:

```text
DPS assigned with low fire resistance
```

Failed:

```text
no valid assignment
```

This lets the player quickly understand risk.

---

## 170. Mechanic Severity

Mechanics should have severity.

Examples:

```text
minor
moderate
high
lethal
wipe
```

The UI should prioritize high-severity mechanics.

Example:

```text
Boss has 50 tags, but only show:

1. Fire Breath — lethal if unassigned
2. Summon Minions — high
3. Burning Floor — moderate
4. Tail Swipe — minor
```

This reduces cognitive overload.

---

## 171. Auto-Resolver and Cognitive Load

The player should not need to read every tag.

The game should transform raw tags into actionable mechanics.

Bad display:

```text
fire_damage, magic_damage, tank_damage, cone, breath, high_damage, periodic
```

Good display:

```text
Fire Breath
Assign someone who can survive fire/magic tank damage.
Suggested: Golem Friend
Reason: Immune to fire
```

Advanced view can still show raw tags.

---

## 172. Default Resolution vs. Creative Resolution

Each mechanic can have a default intended resolution.

Example:

```text
Fire Breath:
  default: tank uses defensive cooldown
```

But the player can solve it creatively.

Example:

```text
Golem Friend is immune to fire.
Assign Golem Friend instead.
```

Both are valid.

This is core to the combat philosophy:

```text
mechanics have intended answers,
but tags and builds allow alternate answers.
```

---

## 173. Mechanic Counter Categories

Counters can be categorized.

### Immunity Counter

```text
fire_damage -> immune_fire
```

Best possible answer.

### Resistance Counter

```text
fire_damage -> high_fire_resistance
```

Good answer.

### Role Counter

```text
tank_damage -> tank
```

Default answer.

### Ability Counter

```text
interruptable -> interrupt
```

Active answer.

### Defensive Counter

```text
tank_buster -> defensive_cooldown
```

Cooldown answer.

### Barrier Counter

```text
raidwide_damage -> barrier_healer
```

Preventive answer.

### Healing Counter

```text
raidwide_damage -> healer
```

Recovery answer.

### Control Counter

```text
summon_minion -> controller
```

Control answer.

### Damage Counter

```text
summon_minion -> DPS assigned to add
```

Kill answer.

---

## 174. Auto-Resolver and Cooldowns

Resolver must consider cooldown availability.

Example:

```text
Fire Breath occurs every 8 ticks.
Tank Rampart cooldown is 20 ticks.
```

The resolver should detect:

```text
Rampart cannot cover every Fire Breath.
```

Possible result:

```text
Fire Breath 1 -> Tank uses Rampart
Fire Breath 2 -> Golem Friend assigned
Fire Breath 3 -> unresolved or lesser defensive
```

This makes boss planning more meaningful.

---

## 175. Auto-Resolver and Timeline

Boss timelines should feed into the resolver.

Example:

```text
Tick 5: Fire Breath
Tick 10: Summon Minion
Tick 15: Fire Breath
Tick 20: Raidwide Flame
```

Resolver output:

```text
Tick 5 Fire Breath:
  assign Golem Friend

Tick 10 Summon Minion:
  assign Dagger DPS

Tick 15 Fire Breath:
  assign Golem Friend

Tick 20 Raidwide Flame:
  assign Barrier Healer
```

The player should be able to preview this before combat if the mechanic is known.

---

## 176. Known vs. Unknown Mechanics

Not all mechanics need to be known at first.

Boss knowledge can be discovered.

Possible states:

```text
unknown
seen_once
identified
mastered
```

Example:

```text
First encounter:
  "Unknown Breath Attack"

After seeing it:
  "Fire Breath — fire/magic/tank damage"

After surviving/analyzing:
  "Suggested counters: fire immunity, fire resistance, tank defensive"
```

This supports discovery without overwhelming new players.

---

## 177. Auto-Resolver Profiles and Knowledge

Resolver profiles can improve as the player learns mechanics.

Example:

```text
Before discovery:
  unknown_breath -> assign tank

After discovery:
  fire_breath -> assign golem_friend
```

This is a good way to preserve exploration.

---

## 178. Auto-Resolver and Item Requirements

Some mechanics require abilities that depend on items.

Example:

```text
Interrupt requires hammer, shield bash, dagger kick, or spell silence.
```

Resolver must check whether the assigned actor actually has:

* required weapon
* required skill
* required item
* enough resource
* cooldown available
* range available

Example:

```text
Interruptable Cast:
  Bruiser has Hammer Shock.
  Hammer Shock requires two-handed hammer equipped.
  Bruiser has hammer equipped.
  Hammer Shock off cooldown.
  assign Bruiser.
```

If not:

```text
Bruiser cannot interrupt because hammer is not equipped.
```

---

## 179. Auto-Resolver and Equipment Loadout

Resolver depends on compiled loadouts.

Before resolving mechanics, the game should know each actor’s compiled combat capabilities.

For each actor:

```text
compiled rotation
available abilities
available defensives
resources
resistances
immunities
cooldowns
tags
role
item requirements
range behavior
```

This ties directly into the rotation runtime compiler.

The resolver should not guess from raw gear. It should use compiled capabilities.

---

## 180. Auto-Resolver and Assignment Overrides

Player overrides should always be possible unless the activity forbids it.

Example:

Default:

```text
Fire Breath -> Tank
```

Player override:

```text
Fire Breath -> Golem Friend
```

The resolver should then validate the override.

Possible validation result:

```text
Valid:
Golem Friend is immune to fire.
```

or:

```text
Warning:
Golem Friend is immune to fire but Fire Breath also deals physical damage.
Expected damage: moderate.
```

or:

```text
Invalid:
Golem Friend cannot be assigned because they are not present in this activity.
```

---

## 181. Auto-Resolver Profiles as Player Strategy

A resolver profile is essentially saved strategy.

Examples:

```text
Fire Chasm Safety
Anti-Caster Setup
Bleed Boss Setup
Solo Defensive
Fast Farm
Challenge+ Conservative
```

This lets players build encounter plans.

Example profile:

```text
Anti-Caster Setup:
  interruptable -> first available interrupt
  magic_damage -> highest magic resistance
  summon_minion -> controller
  raidwide_damage -> barrier healer
```

Profiles should be shareable eventually, but that is not MVP.

---

## 182. Auto-Resolver and Solo Combat

In solo combat:

```text
player is assigned to all mechanics
```

Resolver still helps by explaining:

```text
Fire Breath:
  assigned to you
  expected result: high damage
  suggested counter: fire resistance or immunity
```

If unresolved:

```text
You have no good answer to Fire Breath.
```

This helps solo players learn what they need.

---

## 183. Auto-Resolver and Normal Combat

Normal combat should not require planning.

The resolver can still exist but operate silently.

Example coyote:

```text
Scratch:
  minor bleed
```

Resolver does not need to show a planning interface.

It can simply say in the combat log:

```text
Coyote used Scratch.
Bleeding applied.
```

Planning UI is mostly for:

* bosses
* dungeon end bosses
* raids
* special encounters
* known dangerous mechanics

---

## 184. Auto-Resolver and Boss UI

Boss UI should present a short mechanic list.

Example:

```text
Boss: Emberjaw

Pressing Mechanics:
1. Fire Breath — Tank / Fire / Magic
   Suggested: Golem Friend
   Confidence: High

2. Summon Coyote Pack — Adds
   Suggested: Dagger DPS
   Confidence: Medium

3. Burning Ground — Movement
   Suggested: Auto-move enabled
   Confidence: Medium
```

Advanced view:

```text
Show all tags
Show formula details
Show timeline
Show resolver rules
Show cooldown coverage
```

---

## 185. Auto-Resolver and “Most Pressing to React To”

Each mechanic should have a display priority.

Display priority can consider:

```text
severity
timeline proximity
failure consequence
whether unresolved
whether newly discovered
whether player has a strong counter
```

Example sorting:

```text
unresolved lethal mechanic
known lethal mechanic
high mechanic soon
new mechanic
moderate mechanic
minor mechanic
passive tags
```

This keeps the UI useful.

---

## 186. Auto-Resolver Failure States

The resolver should clearly show failure states.

Examples:

```text
No valid assignment.
Assigned actor lacks required resistance.
Cooldown unavailable.
Resource unavailable.
Target not present.
Actor already assigned to conflicting mechanic.
Mechanic unknown.
```

Failure should not always block combat.

The player can still start combat if allowed.

But the warning should be clear.

Example:

```text
Warning:
Fire Breath is unresolved.
Expected result: likely player death.
```

---

## 187. Auto-Resolver and Conflicting Assignments

One actor may not be able to handle everything.

Example:

```text
Tick 10:
Fire Breath
Summon Minion
Interruptable Cast
```

If Golem Friend is assigned to Fire Breath, they may not also be able to interrupt.

Resolver must detect conflicts.

Conflict types:

```text
same tick action conflict
cooldown conflict
resource conflict
range conflict
role conflict
death/survival risk
```

Output:

```text
Conflict:
Golem Friend assigned to Fire Breath and Interrupt at Tick 10.
They can only resolve one.
```

---

## 188. Auto-Resolver and Confidence Examples

### High Confidence

```text
Fire Breath -> Golem Friend
Reason: immune_fire
Expected damage: 0
```

### Medium Confidence

```text
Fire Breath -> Tank
Reason: Rampart 15% damage reduction
Expected damage: survivable but high
```

### Low Confidence

```text
Fire Breath -> DPS
Reason: no better target available
Expected damage: likely dangerous
```

### Failed

```text
Fire Breath -> unresolved
Reason: no actor has fire immunity, fire resistance, or defensive cooldown
```

---

## 189. Auto-Resolver Data Example

Mechanic:

```json
{
  "id": "fire_breath",
  "displayName": "Fire Breath",
  "tags": ["fire_damage", "magic_damage", "tank_damage"],
  "severity": "lethal",
  "defaultResolution": "tank_defensive",
  "counterPreferences": [
    {
      "type": "immunity",
      "tag": "immune_fire",
      "confidence": "high"
    },
    {
      "type": "resistance",
      "stat": "fire_resistance",
      "minimum": 50,
      "confidence": "medium"
    },
    {
      "type": "role",
      "role": "tank",
      "requiredAbilityTag": "defensive_cooldown",
      "confidence": "medium"
    }
  ]
}
```

Resolver result:

```json
{
  "mechanic": "fire_breath",
  "assignedActor": "golem_friend",
  "resolution": "immune_fire",
  "confidence": "high",
  "expectedDamage": 0
}
```

---

## 190. Item Requirement Data Example

Item:

```json
{
  "id": "ring_of_dodge",
  "displayName": "Ring of Dodge",
  "itemLevel": 3,
  "levelRequirement": 10,
  "powerWindow": {
    "fromLevel": 10,
    "toLevel": 14
  },
  "passives": [
    {
      "id": "power_window_dodge",
      "condition": "player_level_between_10_and_14",
      "effect": {
        "stat": "dodge_chance",
        "amount": 0.12
      }
    }
  ]
}
```

Compiled loadout note:

```text
Ring of Dodge active:
+12% dodge because player level is within 10-14.
```

---

## 191. Item Level Data Example

Weapon:

```json
{
  "id": "serrated_dagger",
  "displayName": "Serrated Dagger",
  "itemLevel": 3,
  "levelRequirement": 4,
  "skill": "short_blade",
  "damage": {
    "piercing": [9, 16],
    "slashing": [4, 8]
  },
  "modifiers": [
    {
      "target": "bleed_damage",
      "operation": "multiply",
      "value": 1.10,
      "source": "item_bonus"
    }
  ]
}
```

The dagger does not define the entire rotation.

It modifies the short blade skill’s existing bleed behavior.

---

## 192. Combined Example — Fire Chasm With Power Window Item

Player party:

```text
Player:
  short_blade dagger
  Ring of Dodge active

Golem Friend:
  immune_fire

Barrier Healer:
  party barrier

Hammer Bruiser:
  interrupt
```

Dungeon:

```text
Fire Chasm
common mechanics:
  fire_damage
  burning_ground
  interruptable_cast
```

Player-created resolver profile:

```text
Fire damage -> Golem Friend
Interruptable cast -> Hammer Bruiser
Raidwide fire -> Barrier Healer
Minor melee -> Player
```

Resolver output:

```text
Fire Breath:
  assigned to Golem Friend
  confidence high
  reason: immune_fire

Flame Channel:
  assigned to Hammer Bruiser
  confidence high
  reason: interrupt available

Burning Wave:
  assigned to Barrier Healer
  confidence medium
  reason: party barrier

Minor Adds:
  assigned to Player
  confidence medium
  reason: short blade single-target damage
```

This is the intended system identity:

```text
many tags exist under the hood
player sees the pressing problems
auto-resolver suggests answers
player can override with creative strategy
```

---

## 193. Expansion Summary

```text
Item level:
  defines stat baseline and content tier.

Level requirement:
  defines who can equip/use the item.

Power window:
  makes items temporarily very strong in a level range.

Conditional passives:
  item effects can activate only under certain conditions.

Rotation compiler:
  should include active item passives and item-level modifiers.

Auto-resolver:
  reduces boss/raid cognitive load.

Mechanics:
  should be structured, not raw tags only.

Pressing mechanics:
  shown to player before passive tags.

Resolver profiles:
  allow saved player strategy.

Player override:
  always allowed where activity permits.

Item requirements:
  checked by resolver before assigning abilities.

Compiled loadout:
  provides resolver with actual actor capabilities.

Difficulty:
  affects numbers and XP through magic_number.

Goal:
  preserve build creativity while preventing tag overload.
```
Got it. These decisions tighten the resolver design a lot. I would capture them like this as the next expansion section.

## 194. Boss Encounter Baseline Philosophy

Boss mechanics should eventually be defined across all difficulties.

The long-term goal is to have a complete boss encounter library:

```text id="g864xq"
boss
difficulty
timeline
mechanics
resolver expectations
known/unknown mechanic state
assignment requirements
failure behavior
```

This is not MVP work.

It is a large design/content task and should be handled later.

For now, the important rule is:

```text id="iorvbd"
The system should be scalable enough to support full boss definitions later.
```

Normal, hard, and extreme versions can share most mechanics.

Higher difficulties can add mechanics.

Example:

```text id="9rv1ak"
Normal:
  Fire Breath
  Tail Swipe

Hard:
  Fire Breath
  Tail Swipe
  Burning Ground

Extreme:
  Fire Breath
  Tail Swipe
  Burning Ground
  Flame Prison

Extreme+:
  includes secret/hidden mechanics
```

---

## 195. Mechanic Assignment Validation

The resolver’s most important validation job is:

```text id="h3mib1"
Have all mechanics been assigned to?
```

A mechanic should not be left missing.

Even a bad assignment is different from no assignment.

Example:

```text id="qx5frl"
Buster:
  assigned to undergeared tank
  expected result: bad execution
```

This can continue if the player accepts the risk.

But:

```text id="6m20tw"
Buster:
  no assignment
```

should be treated as unresolved and should block or strongly prevent starting, depending on activity rules.

Core distinction:

```text id="t26swi"
missing resolution = not allowed / blocked
bad resolution = allowed with warning
```

Example UI:

```text id="3u37uo"
All mechanics assigned.

Warnings:
- Bad execution expected for Buster.
  Assigned tank is undergeared.
  Expected result: likely death.
```

This is better than silently letting the player miss a mechanic.

---

## 196. Resolver Does Not Need Good Answers, But Needs Answers

The resolver does not require every assignment to be optimal.

It requires every known mechanic to have an assignment.

Valid assignment qualities:

```text id="wzfj0z"
perfect
good
acceptable
bad
likely_fail
```

Invalid assignment state:

```text id="nd8bs8"
missing
```

Examples:

```text id="h4wfyg"
Fire Breath -> Golem Friend
quality: perfect
reason: immune_fire
```

```text id="lv8yh3"
Fire Breath -> Tank
quality: acceptable
reason: defensive cooldown available
```

```text id="ts4lqx"
Fire Breath -> Low-level DPS
quality: likely_fail
reason: no resistance, low HP
```

```text id="6r1362"
Fire Breath -> none
quality: missing
result: cannot proceed / requires assignment
```

The player can choose bad strategy. The system should not allow accidental missing strategy.

---

## 197. Mechanic Occurrence Patterns

Mechanics can occur in different patterns.

Suggested occurrence types:

```text id="m44fsf"
single
multi
round_robin
repeating
conditional
secret
```

### Single

Happens once.

Example:

```text id="kzcfj4"
At 50% HP, boss casts Collapse.
```

### Multi

Requires multiple actors or multiple assignments.

Example:

```text id="blexfs"
Twin Strike:
  assign 2 targets
```

### Round Robin

Happens repeatedly and should rotate assignments.

Example:

```text id="yif8d2"
Buster happens every 8 ticks.
Rotate between Tank A and Tank B.
```

### Conditional

Depends on party, tags, race, state, or previous actions.

Funny but valid example:

```text id="h1qj5o"
Boss targets elves.
If party has an elf, assign elven actor.
```

This implies mechanics can query actor tags.

### Secret

Exists on higher difficulties or hidden encounter states.

May show incomplete information.

---

## 198. Actor-Tag-Based Mechanics

Mechanics can target actors based on actor tags.

Example:

```text id="fkz7xw"
This boss is racist, targets elves.
```

Mechanic concept:

```text id="juhmyh"
Elf Hatred:
  target_rule: actor_has_tag(elf)
  assignment_requirement: assign elven actor if present
```

This is a funny example, but structurally useful.

Other examples:

```text id="vabtwg"
targets_healer
targets_highest_magic_power
targets_lowest_hp
targets_fire_aligned
targets_non_tank
targets_summoner
```

This allows boss mechanics to be expressive without hardcoding.

---

## 199. Encounter Party Selection Scope

Resolver should work only with the party selected for the encounter.

If the player has a roster of 100 companions, the resolver should not recommend companions who are not selected.

Example:

```text id="zzmnpw"
Player roster:
  Golem Friend
  Hammer Bruiser
  Barrier Healer
  Dagger DPS
  20 others

Selected party:
  Hammer Bruiser
  Barrier Healer
  Dagger DPS
```

If Golem Friend is not selected:

```text id="u6dxkz"
Do not recommend Golem Friend for fire damage.
```

This simplifies resolver logic and respects player choice.

The selected party is the resolver’s universe.

---

## 200. Favorites and Roster Later

Players may eventually have:

```text id="poeedr"
roster
favorites
preferred companions
saved party presets
```

But resolver should primarily use:

```text id="53y4a4"
currently selected party for this encounter
```

Later, before party lock-in, the game may suggest:

```text id="s6v1qf"
You have no answer to Fire Breath.
A roster member, Golem Friend, could solve it.
```

But during encounter assignment, use selected party only.

This avoids overwhelming recommendations.

---

## 201. No Same-Tick Multi-Resolution by One Actor

One actor should not solve multiple same-tick mechanics.

Default rule:

```text id="1hvywb"
one actor = one mechanic resolution per mechanic timing window
```

Even if one solution is passive, do not count one actor as solving multiple mechanics at the same time.

This keeps assignment clean and avoids confusing edge cases.

Example:

```text id="hc3of4"
Tick 10:
Fire Breath
Interruptable Cast
```

Even if the golem is immune to fire, if assigned to Fire Breath, they should not also be assigned to interrupt the cast in the same mechanic window.

This may be conservative, but it is easier to reason about.

Later, exceptions can exist explicitly if needed, but default is no.

---

## 202. Resolver Rule Type: Hard Solutions

Player rules should be hard solution rules, not soft preferences.

If the player says:

```text id="ez6gz3"
Assign fire_damage to fire-immune actor.
```

That is a solution, not a suggestion.

Example rule:

```text id="t5t3hl"
fire_damage -> Golem Friend
```

If Golem Friend is selected and valid:

```text id="33znuj"
use Golem Friend
```

If Golem Friend is not selected or invalid:

```text id="hgtwfl"
rule fails
mechanic needs another explicit assignment
```

Do not silently replace it with a weaker option unless a fallback rule is explicitly defined.

This makes player-created strategies predictable.

---

## 203. Resolver Assignment Quality

Even with hard assignments, the resolver should evaluate quality.

Possible quality levels:

```text id="3kawtp"
perfect
strong
acceptable
bad
likely_fail
missing
```

Example:

```text id="ykmz28"
Fire Breath -> Golem Friend
quality: perfect
reason: immune_fire
```

```text id="5gf4j8"
Fire Breath -> Tank
quality: acceptable
reason: Rampart available
```

```text id="xqiorj"
Fire Breath -> Low-Level Rogue
quality: likely_fail
reason: low level, no fire resistance
```

This allows bad execution warnings without blocking experimentation.

---

## 204. Known and Unknown Mechanics by Difficulty

Mechanic visibility can depend on difficulty and encounter knowledge.

Normal, hard, and extreme may share most mechanics.

Higher difficulties add more.

Extreme+ or secret difficulties can include hidden mechanics.

Visibility model:

```text id="hw5woo"
known mechanic:
  show mechanic name and important tags

partially known mechanic:
  show attack description or one important tag
  hide rest as ???

unknown mechanic:
  show ??? or generic warning
```

Example:

```text id="q2k4a8"
Fire Breath:
  fire_damage
  ???
  ???
```

Resolver can only solve the exposed/known part.

If only `fire_damage` is known:

```text id="o5wyfw"
resolver assigns fire counter
```

But hidden tags may still cause surprises.

Example:

```text id="v09zzr"
Fire Breath:
  known: fire_damage
  hidden: physical_knockback, armor_break
```

Player assigned fire-immune golem.

Result:

```text id="yw77g8"
fire damage negated
knockback still happens
armor break discovered
```

This preserves discovery.

---

## 205. Resolver and Unknown Tags

The resolver should not magically solve unknown hidden tags.

If a mechanic shows:

```text id="ioqerm"
fire_damage
???
???
```

Resolver solves:

```text id="qc4sng"
fire_damage
```

But not the hidden parts.

This allows:

* partial preparation
* surprise mechanics
* discovery
* progression knowledge

After the mechanic is seen, it can become more defined.

---

## 206. Boss Difficulty Mechanic Growth

Difficulty can add mechanics.

Example structure:

```text id="crd8q8"
Normal:
  Fire Breath
  Tail Swipe

Hard:
  Normal mechanics +
  Burning Ground

Extreme:
  Hard mechanics +
  Flame Prison

Extreme+:
  Extreme mechanics +
  Secret mechanic hidden until seen
```

This lets boss design scale cleanly.

Difficulty may also change:

* damage numbers
* HP
* timing
* mechanic frequency
* number of assignments required

But earlier decision remains:

```text id="ktv8w0"
Challenge+ changes health and damage,
not armor and resistance values.
```

---

## 207. Power Window Final Rule

Power-window items fully deactivate outside their window.

No fallback.

Reason:

```text id="a5fz82"
Fallback bonuses are exploitable.
```

Example:

```text id="f0n1eg"
Ring of Dodge:
  required_level: 10
  power_window: 10-14
  effect: +12% dodge

At level 15:
  +12% dodge disabled
```

The item may still exist, but the power-window effect is inactive.

The UI should clearly show:

```text id="orjjjy"
Power Window Expired
```

---

## 208. Difficulty Magic Number Final Scope

Difficulty magic_number applies to XP calculation only.

It does not apply to:

* money
* monster drops
* armor
* resistance
* item requirements
* mechanic identity
* resolver rules

Money is a monster drop and should be defined per monster or activity loot table.

Difficulty is an arbitrary progression number.

It can become very large.

Example:

```text id="6uc3ru"
level 50 content
difficulty_magic_number: 10000
```

That is acceptable if the progression model supports it.

Final XP idea:

```text id="ykgmx6"
XP = base XP × difficulty_magic_number × other XP modifiers
```

---

## 209. Auto-Resolver MVP Status

Resolver MVP is not required right now.

The current MVP remains:

```text id="hk09gc"
old dagger vs coyote
```

A simple boss can be discussed later.

Resolver should be designed for later, not implemented immediately.

Normal combat can ignore planning UI.

Boss resolver comes when boss content begins.

---

## 210. Resolver Presets Are Approved

Resolver presets are desirable.

Yes, use presets.

Examples:

```text id="37cvai"
default
safe
aggressive
immunity_first
tank_first
barrier_first
manual_review
```

Player-created profiles can come later.

For early boss design, presets reduce complexity.

---

## 211. Final Resolver Principles

```text id="qc8b9g"
Resolver works on selected party, not full roster.

All known mechanics must be assigned.

Missing assignment is invalid.

Bad assignment is allowed with warning.

Hard rules are preferred over soft preferences.

One actor should not solve multiple same-window mechanics.

Unknown tags remain unresolved until discovered.

Resolver solves only known/exposed mechanic parts.

Power-window item effects fully deactivate outside range.

Difficulty magic_number applies to XP only.

Resolver MVP is not needed yet.
```

---

## 212. Remaining Design Direction

The next useful design topic later would be the first simple boss.

Not full raid resolver.

Just one boss with:

```text id="q4245k"
2-3 mechanics
one timeline
known tags
one bad assignment warning
one clean solution
one hidden or partially known mechanic if desired
```

That would let the resolver design become concrete without creating a week-long boss encyclopedia.
