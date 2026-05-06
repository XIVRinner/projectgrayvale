#!/usr/bin/env node

/**
 * Creates GitHub labels, issues, a GitHub Project, and a docs file for:
 * Grayvale Character Sheet MVP
 *
 * Windows PowerShell usage:
 *   $env:REPO_FULL_NAME="owner/repo"
 *   node .\scripts\create-grayvale-character-sheet-github.mjs
 *
 * Optional:
 *   $env:PROJECT_OWNER="owner-or-org"
 *   $env:PROJECT_TITLE="Grayvale Character Sheet MVP"
 *
 * Requirements:
 *   - Node.js
 *   - GitHub CLI installed
 *   - gh auth login
 *
 * Notes:
 *   - Additive/idempotent where practical.
 *   - Existing labels are skipped.
 *   - Existing docs file is updated.
 *   - Project creation may fail if gh project permissions are missing; issues still get created.
 */

import { execFileSync } from "node:child_process";

const REPO_FULL_NAME = process.env.REPO_FULL_NAME;
const PROJECT_TITLE = process.env.PROJECT_TITLE ?? "Grayvale Character Sheet MVP";

if (!REPO_FULL_NAME || !REPO_FULL_NAME.includes("/")) {
  console.error(`
Missing REPO_FULL_NAME.

PowerShell:
  $env:REPO_FULL_NAME="owner/repo"
  node .\\scripts\\create-grayvale-character-sheet-github.mjs
`);
  process.exit(1);
}

const [repoOwner] = REPO_FULL_NAME.split("/");
const PROJECT_OWNER = process.env.PROJECT_OWNER ?? repoOwner;

function gh(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  }).trim();
}

function ghJson(args) {
  const output = gh(args);
  return output ? JSON.parse(output) : null;
}

function safeGh(args, description) {
  try {
    return gh(args);
  } catch (error) {
    console.warn(`⚠️  Skipped: ${description}`);
    const message = error?.stderr?.toString?.() || error.message;
    if (message) console.warn(message.trim());
    return null;
  }
}

function labelExists(name) {
  try {
    gh(["label", "view", name, "--repo", REPO_FULL_NAME]);
    return true;
  } catch {
    return false;
  }
}

function createLabel(name, color, description) {
  if (labelExists(name)) {
    console.log(`↪ Label exists: ${name}`);
    return;
  }

  safeGh(
    [
      "label",
      "create",
      name,
      "--repo",
      REPO_FULL_NAME,
      "--color",
      color,
      "--description",
      description,
    ],
    `create label ${name}`
  );
}

function createIssue(issue) {
  const args = [
    "issue",
    "create",
    "--repo",
    REPO_FULL_NAME,
    "--title",
    issue.title,
    "--body",
    issue.body,
  ];

  for (const label of issue.labels) {
    args.push("--label", label);
  }

  return gh(args);
}

function createProject() {
  try {
    const existingProjects = ghJson([
      "project",
      "list",
      "--owner",
      PROJECT_OWNER,
      "--format",
      "json",
      "--limit",
      "100",
    ]);

    const existing = existingProjects.projects?.find(
      (project) => project.title === PROJECT_TITLE
    );

    if (existing) {
      console.log(`✅ Project already exists: ${PROJECT_TITLE} (#${existing.number})`);
      return existing.number;
    }
  } catch {
    console.warn("⚠️  Could not list existing GitHub Projects. Trying to create one.");
  }

  try {
    const created = ghJson([
      "project",
      "create",
      "--owner",
      PROJECT_OWNER,
      "--title",
      PROJECT_TITLE,
      "--format",
      "json",
    ]);

    console.log(`✅ Created project: ${PROJECT_TITLE} (#${created.number})`);
    return created.number;
  } catch (error) {
    console.warn("⚠️  Could not create GitHub Project.");
    console.warn("Issues and docs will still be created.");
    const message = error?.stderr?.toString?.() || error.message;
    if (message) console.warn(message.trim());
    return null;
  }
}

function addIssueToProject(projectNumber, issueUrl) {
  if (!projectNumber) return;

  safeGh(
    [
      "project",
      "item-add",
      String(projectNumber),
      "--owner",
      PROJECT_OWNER,
      "--url",
      issueUrl,
    ],
    `add issue to project: ${issueUrl}`
  );
}

function getDefaultBranch() {
  const data = ghJson([
    "repo",
    "view",
    REPO_FULL_NAME,
    "--json",
    "defaultBranchRef",
  ]);

  return data.defaultBranchRef.name;
}

function getExistingFileSha(path, branch) {
  try {
    const data = ghJson([
      "api",
      `repos/${REPO_FULL_NAME}/contents/${path}`,
      "-f",
      `ref=${branch}`,
    ]);

    return data.sha;
  } catch {
    return null;
  }
}

function upsertRepoFile({ path, content, message }) {
  const branch = getDefaultBranch();
  const sha = getExistingFileSha(path, branch);
  const encoded = Buffer.from(content, "utf8").toString("base64");

  const args = [
    "api",
    `repos/${REPO_FULL_NAME}/contents/${path}`,
    "--method",
    "PUT",
    "-f",
    `message=${message}`,
    "-f",
    `content=${encoded}`,
    "-f",
    `branch=${branch}`,
  ];

  if (sha) {
    args.push("-f", `sha=${sha}`);
  }

  try {
    ghJson(args);
    console.log(`${sha ? "✅ Updated" : "✅ Created"} ${path}`);
  } catch (error) {
    console.warn(`⚠️  Could not upsert ${path}`);
    const msg = error?.stderr?.toString?.() || error.message;
    if (msg) console.warn(msg.trim());
  }
}

const labels = [
  ["mvp", "7057ff", "Part of MVP scope"],
  ["character-sheet", "c5def5", "Character sheet feature work"],
  ["angular", "dd0031", "Angular implementation"],
  ["ui", "fbca04", "User interface work"],
  ["inventory", "0e8a16", "Inventory system work"],
  ["equipment", "1d76db", "Equipment system work"],
  ["loadouts", "bfdadc", "Loadout system work"],
  ["tooltip", "fef2c0", "Tooltip and item presentation work"],
  ["rarity", "d4c5f9", "Rarity presentation and rules"],
  ["stat-math", "5319e7", "Character stat calculation and breakdowns"],
  ["data-model", "5319e7", "Data structures and models"],
  ["documentation", "0075ca", "Documentation"],
  ["testing", "c2e0c6", "Tests and validation"],
];

const docContent = `# Grayvale Character Sheet MVP

## Purpose

The Character Sheet MVP is a separate project from the Combat MVP.

It is the player-facing hub for:

- character identity
- combat-relevant math
- equipment
- loadouts
- inventory
- item actions
- item tooltips
- rarity presentation

The page should be implemented in Angular 21.

The implementation should stay MVP-focused and data-driven.

## Goals

- Show character identity.
- Show equipment slots.
- Support loadouts.
- Show inventory split by category.
- Support inventory/equipment actions.
- Show combat math with buffed/nerfed values.
- Show stat breakdowns.
- Show equipment, material, quest item, and junk tooltips.
- Show rarity-specific visual treatment.
- Support future non-combat stats without implementing them yet.

## Non-Goals

Do not implement these in the MVP:

- full combat simulation
- raid resolver
- dungeon inventory logic
- crafting UI
- vendor UI
- drag-and-drop polish
- final animation implementation
- full persistence
- multiplayer
- complete equipment balance
- complete stat taxonomy

## Character Identity

The character sheet should display:

- name
- race
- gender
- level
- class/archetype if available
- adventurer rank when unlocked
- character tags when relevant

Race may eventually produce tags.

Example:

\`\`\`text
Race: Elf
Tags: elf, humanoid
\`\`\`

Gender is display-only for MVP unless future systems use it.

Adventurer rank is optional/unlocked.

## Combat Math

The sheet should show final calculated combat stats.

Examples:

\`\`\`text
Strength: 40 (+20)
Mentality: 10 (-20)
Dodge: 18% (+12%)
Slashing Armor: 4
Piercing Armor: 2
Fire Resistance: -10
\`\`\`

Color rules:

- green = buffed/improved
- red = nerfed/reduced
- neutral = unchanged
- muted = inactive/expired/locked
- gold/special = legendary or special source

Every final number should be explainable through a breakdown.

Example:

\`\`\`text
Strength 40
Base: 20
Brutal Ring: +20
Final: 40
\`\`\`

Example:

\`\`\`text
Mentality 10
Base: 30
Cursed Ring: -20
Final: 10
\`\`\`

## Equipment

MVP equipment slots:

- head
- chest
- gloves
- legs
- boots
- main_hand
- off_hand
- ring

The equipment panel should show:

- equipped item
- empty slot state
- rarity frame
- item level
- special rarity badges
- power-window state if any
- tooltip trigger
- comparison when relevant

## Loadouts

MVP loadout model:

- loadout id
- display name
- equipment slot map
- active flag
- optional notes

MVP actions:

- create loadout
- rename loadout
- select active loadout
- equip item to active loadout
- unequip item from active loadout
- compare item against active loadout slot

Future:

- resolver profile attached to loadout
- rotation profile attached to loadout
- activity restrictions
- galvanized validation
- boss-specific warnings

## Inventory

Inventory categories:

- equipment
- materials
- quest items
- junk

Inventory should support actions.

MVP actions:

- equip
- unequip
- compare
- move item to loadout
- inspect tooltip
- mark favorite if easy
- filter by category
- search if easy

Materials should show:

- quantity
- rarity
- quality stars when applicable
- crafting tags
- source if known

Quest items should show:

- quest/use context
- description
- special rarity if any

Junk should show:

- sell value if known
- description
- flavor

## Tooltip Families

Tooltips share a visual family but differ by item type.

Families:

- equipment tooltip
- material tooltip
- quest item tooltip
- junk tooltip

Equipment tooltip is richest.

Equipment tooltip sections:

- header
- rarity
- slot
- item level
- requirements
- combat stats
- skill association
- rotation impact
- special effects
- power window
- tags
- training impact
- flavor

Material tooltip sections:

- rarity
- quantity
- quality stars if applicable
- crafting use
- source
- tags
- flavor

Quest tooltip sections:

- quest/use
- special state
- description
- flavor

Junk tooltip sections:

- sell value
- description
- flavor

## Rarity Visual Language

Base rarities:

- junk
- common
- uncommon
- rare
- epic
- legendary
- ephemeral
- mythical
- primal

Special rarities:

- cursed
- divine
- infernal
- phantom
- temporal
- secret
- galvanized

Normal rarities can use static accents.

Legendary+ and special rarities should have special visual treatment. Animation implementation is not required in MVP, but the intended animation language should be documented in the component styling comments or design notes.

### Legendary

Look:

- gold/orange frame
- distinct legendary effect block
- subtle premium glow

Animation direction:

- slow breathing border glow
- small shimmer across legendary effect title

### Ephemeral

Look:

- pale gold / spectral-gold frame
- legendary effect marked as maximized

Animation direction:

- soft fading shimmer
- translucent aura

### Mythical

Look:

- deep violet + gold frame
- ornate structure
- all rolls marked maxed

Animation direction:

- slow star-like sparkle on corners
- subtle flowing border

### Primal

Look:

- ancient red/gold/white frame
- strongest visual identity
- primal bonus has its own highlighted block

Animation direction:

- low-frequency pulsing aura
- occasional rune flicker

### Cursed

Look:

- dark red/black cracked overlay
- warning treatment
- curse section near top

Animation direction:

- faint red pulse
- crack/glitch flicker

### Divine

Look:

- white/gold clean glow
- sacred frame overlay

Animation direction:

- gentle radiance
- slow vertical light sweep

### Infernal

Look:

- black/red/orange heat treatment
- burning edge accent

Animation direction:

- ember particles
- heat shimmer

### Phantom

Look:

- blue/grey translucent ghosted frame
- remaining uses displayed prominently

Animation direction:

- fading opacity shimmer
- ghost trail flicker

### Temporal

Look:

- blue/gold time motif
- clock/rift accent
- context restriction block

Animation direction:

- slow rotating glyph/ring
- subtle time ripple

### Secret

Look:

- dark frame with hidden glyphs
- mystery accent
- revealed/unrevealed state

Animation direction:

- glyphs appear and vanish faintly

### Galvanized

Look:

- electric/charged overlay
- metallic bright edge
- temporary boost badge

Animation direction:

- short electric arc flicker
- charged border pulse

## MVP Page Layout

Suggested layout:

\`\`\`text
Top Header:
  Character portrait/name/race/gender/level/rank

Left Column:
  Equipment slots
  Loadout selector

Center Column:
  Combat stats summary
  Stat breakdown tabs
  Rotation preview summary placeholder

Right Column:
  Inventory tabs
  Item details / compare panel
\`\`\`

## Angular Notes

Use Angular 21.

The implementation should be componentized:

- character-sheet-page
- character-identity-header
- equipment-panel
- equipment-slot
- loadout-selector
- inventory-panel
- inventory-item-row/card
- stat-summary
- stat-breakdown
- item-tooltip
- equipment-tooltip
- material-tooltip
- quest-item-tooltip
- junk-tooltip

Use static/mock data first.

Keep the data model clean so it can connect to real game state later.
`;

const issues = [
  {
    title: "Define Character Sheet MVP scope and README",
    labels: ["mvp", "character-sheet", "documentation"],
    body: `Create or update documentation for the Character Sheet MVP.

This is a separate project from combat. It should target Angular 21 and focus on character identity, equipment, inventory, loadouts, stat math, and item tooltips.

## Acceptance Criteria

- \`docs/character-sheet-mvp.md\` exists.
- The doc explains goals and non-goals.
- The doc states that the implementation targets Angular 21.
- The doc explains equipment, inventory, loadouts, combat math, and tooltips.
- The doc includes rarity visual language for legendary+ and special rarities.
- Scope does not include combat simulation, boss resolver, crafting UI, vendor UI, or final animation implementation.`,
  },
  {
    title: "Define character identity and character sheet models",
    labels: ["mvp", "character-sheet", "data-model"],
    body: `Define the MVP character sheet data models.

## Required Character Identity Fields

- character id
- display name
- race
- gender
- level
- class/archetype optional
- adventurer rank optional/unlocked
- tags
- active loadout id
- inventory reference or inventory collection

Race should be able to provide tags later, such as \`elf\`, \`human\`, \`humanoid\`, etc.

Gender is display-only for MVP.

Adventurer rank should be optional because it is unlocked later.

## Acceptance Criteria

- Character sheet model supports identity display.
- Character sheet model supports future combat-relevant tags.
- Adventurer rank can be missing/locked.
- Models are not tied to one hardcoded character.
- Angular components can consume these models as typed data.`,
  },
  {
    title: "Define stat math and modifier breakdown models",
    labels: ["mvp", "character-sheet", "stat-math", "data-model"],
    body: `Define models for character stat math and breakdowns.

The character sheet must show final stats and explain where each number came from.

## Required Concepts

- base stat value
- equipment modifiers
- buff modifiers
- debuff/nerf modifiers
- conditional modifiers
- inactive modifiers
- final value
- display state

## Display Rules

- green = buffed/improved above base
- red = nerfed/reduced below base
- neutral = unchanged
- muted = inactive/expired/locked
- special/gold = legendary or special source

## Example

\`\`\`text
Strength 40
Base: 20
Brutal Ring: +20
Final: 40
\`\`\`

\`\`\`text
Mentality 10
Base: 30
Cursed Ring: -20
Final: 10
\`\`\`

## Acceptance Criteria

- Model supports additive and multiplicative modifiers.
- Model supports source labels.
- Model supports inactive modifiers.
- Model supports final value display state.
- Model can represent buffed and nerfed numbers.
- Non-combat stats can be supported later without redesign.`,
  },
  {
    title: "Define equipment slot and loadout models",
    labels: ["mvp", "character-sheet", "equipment", "loadouts", "data-model"],
    body: `Define MVP equipment and loadout models.

## MVP Equipment Slots

- head
- chest
- gloves
- legs
- boots
- main_hand
- off_hand
- ring

## Loadout Model

A loadout should include:

- id
- display name
- equipment slot map
- active flag
- optional notes

## MVP Loadout Actions

- create loadout
- rename loadout
- select active loadout
- equip item into active loadout
- unequip item from active loadout
- compare item against active loadout slot

## Future Compatibility

The model should be able to later support:

- resolver profile
- rotation profile
- activity restrictions
- galvanized validation
- boss-specific warnings

## Acceptance Criteria

- Equipment slot model exists.
- Loadout model exists.
- Character can have multiple loadouts.
- One loadout can be active.
- Items can be assigned by slot.
- Invalid/empty slots are representable.`,
  },
  {
    title: "Define inventory item category models",
    labels: ["mvp", "character-sheet", "inventory", "data-model", "rarity"],
    body: `Define inventory models for equipment and non-equipment items.

## Inventory Categories

- equipment
- materials
- quest_items
- junk

## Shared Item Fields

- id
- display name
- item type
- rarity
- special rarities
- quantity where relevant
- tags
- description/flavor optional

## Equipment Fields

- slot
- item level
- requirements
- combat stats
- special effects
- tooltip data

## Material Fields

- quantity
- rarity
- quality stars if applicable
- crafting tags
- source if known

## Quest Item Fields

- quest/use context
- temporal/secret/special designation if any
- usable/locked state

## Junk Fields

- sell value if known
- description
- flavor

## Acceptance Criteria

- Inventory supports all required categories.
- Materials support quantity.
- Materials support quality stars when applicable.
- Legendary/divine/infernal materials can exist without quality stars.
- Quest items and junk do not use equipment tooltip format.
- Models support rarity and special rarity display.`,
  },
  {
    title: "Design equipment panel UI",
    labels: ["mvp", "character-sheet", "equipment", "ui", "angular"],
    body: `Design and implement the MVP equipment panel in Angular 21.

## Required UI

- equipment slot grid/list
- empty slot state
- equipped item state
- rarity frame/accent
- item level display
- special rarity badges
- power-window badge if applicable
- tooltip trigger
- compare trigger if item is hovered/selected from inventory

## Required Slots

- head
- chest
- gloves
- legs
- boots
- main_hand
- off_hand
- ring

## Acceptance Criteria

- Equipment panel renders from data.
- Empty slots are clear.
- Equipped slots show item name/icon placeholder.
- Rarity is visible.
- Special rarity badges are visible.
- Tooltip can be opened from equipment slot.
- Component does not hardcode the MVP items.`,
  },
  {
    title: "Design and implement loadout selector UI",
    labels: ["mvp", "character-sheet", "loadouts", "ui", "angular"],
    body: `Design and implement the MVP loadout selector.

## Required Actions

- view loadouts
- create loadout
- rename loadout
- select active loadout
- equip item to active loadout
- unequip item from active loadout

## MVP Behavior

Use mock/static data if real persistence does not exist yet.

## Acceptance Criteria

- Active loadout is visible.
- Switching loadout updates displayed equipment.
- Renaming works in local component state or mock store.
- Creating a loadout works in local component state or mock store.
- Equip/unequip actions update the active loadout.
- No backend persistence is required.`,
  },
  {
    title: "Design inventory UI with item actions",
    labels: ["mvp", "character-sheet", "inventory", "ui", "angular"],
    body: `Design and implement the MVP inventory panel.

## Inventory Sections

- Equipment
- Materials
- Quest Items
- Junk

## Required Actions

- inspect tooltip
- compare equipment
- equip equipment
- unequip equipment
- move/equip item to active loadout
- filter by category
- search if simple

## Display Requirements

- item name
- rarity
- special rarity badges
- quantity
- quality stars for materials where applicable
- item level for equipment
- item type/category

## Acceptance Criteria

- Inventory renders from data.
- Category tabs or sections exist.
- Equipment items can be equipped.
- Equipped items can be unequipped.
- Equipment can be compared against active loadout slot.
- Materials show quantity and quality stars.
- Quest items and junk have correct simpler presentation.`,
  },
  {
    title: "Design combat math UI and stat breakdowns",
    labels: ["mvp", "character-sheet", "stat-math", "ui", "angular"],
    body: `Design and implement the combat math section of the character sheet.

## Required Sections

- primary stats
- derived combat stats
- resistances/armor
- resources placeholder
- stat breakdown drawer/panel

## Required Visual Rules

- green values for buffs/improvements
- red values for nerfs/reductions
- neutral values for unchanged
- muted values for inactive/expired modifiers

## Example Stats

- Strength
- Mentality
- Dodge
- Slashing Armor
- Piercing Armor
- Fire Resistance
- Mana
- HP

## Acceptance Criteria

- Stats render from calculated data.
- Buffed values display green.
- Nerfed values display red.
- Each stat can show a source breakdown.
- Equipment modifiers affect displayed final values.
- Inactive modifiers can be displayed but not counted.
- Non-combat/social stats can be added later without redesign.`,
  },
  {
    title: "Design tooltip component system",
    labels: ["mvp", "character-sheet", "tooltip", "ui", "angular"],
    body: `Design the item tooltip component system.

Tooltips should share a visual family but differ by item type.

## Tooltip Families

- equipment tooltip
- material tooltip
- quest item tooltip
- junk tooltip

## Equipment Tooltip Sections

- header
- rarity
- slot
- item level
- requirements
- combat stats
- skill association
- rotation impact
- special effects
- power window
- tags
- training impact
- flavor

## Material Tooltip Sections

- rarity
- quantity
- quality stars if applicable
- crafting use
- source
- tags
- flavor

## Quest Tooltip Sections

- quest/use
- special state
- description
- flavor

## Junk Tooltip Sections

- sell value
- description
- flavor

## Acceptance Criteria

- Shared tooltip shell exists.
- Equipment tooltip exists.
- Material tooltip exists.
- Quest item tooltip exists.
- Junk tooltip exists.
- Tooltips render from typed data.
- Tooltip logic does not assume every item is equipment.`,
  },
  {
    title: "Design rarity tooltip visual language",
    labels: ["mvp", "character-sheet", "tooltip", "rarity", "ui"],
    body: `Design rarity-specific tooltip presentation.

Normal base rarities should use static accents.

Legendary+ and special rarities should have special visual treatment. Animation implementation is not required, but describe intended animation behavior in comments/design notes.

## Base Rarities

- junk
- common
- uncommon
- rare
- epic
- legendary
- ephemeral
- mythical
- primal

## Special Rarities

- cursed
- divine
- infernal
- phantom
- temporal
- secret
- galvanized

## Legendary+ Required Treatment

Legendary:
- gold/orange frame
- legendary effect block
- intended animation: slow breathing glow, shimmer

Ephemeral:
- spectral gold frame
- legendary effect marked maximized
- intended animation: soft shimmer

Mythical:
- violet/gold ornate frame
- all rolls marked maxed
- intended animation: star-like sparkle

Primal:
- ancient red/gold/white frame
- primal bonus block
- intended animation: rune flicker, pulsing aura

## Special Required Treatment

Cursed:
- warning treatment
- cracked red/black overlay

Divine:
- white/gold sacred glow

Infernal:
- heat/burning edge treatment

Phantom:
- translucent ghosted frame
- remaining uses prominent

Temporal:
- time/rift motif
- context restriction prominent

Secret:
- hidden glyph/mystery treatment

Galvanized:
- electric/charged overlay
- activity allowed/blocked state if applicable

## Acceptance Criteria

- Rarity design notes exist.
- Tooltip components can receive base rarity and special rarities.
- Legendary+ items have special sections.
- Cursed/phantom/temporal/galvanized states are impossible to miss.
- Animation direction is documented but not implemented as required behavior.`,
  },
  {
    title: "Implement character sheet mock data fixtures",
    labels: ["mvp", "character-sheet", "data-model", "angular"],
    body: `Create mock data fixtures for the Character Sheet MVP.

## Required Mock Data

Character:
- name
- race
- gender
- level
- adventurer rank locked or unlocked
- base stats

Equipment:
- old dagger
- rags
- worn leather chestpiece
- ring with +20 strength and -20 mentality
- one legendary+ example item
- one special rarity example item

Inventory:
- equipment item
- material item with quality stars
- legendary/divine/infernal material without quality stars
- quest item
- junk item

Loadouts:
- Default
- Dodge Build or Fire Chasm placeholder

## Acceptance Criteria

- Character sheet can render using only mock data.
- Stat math can show green and red values.
- Equipment panel has filled and empty slots.
- Inventory has each category represented.
- Tooltips can be tested with multiple rarity types.`,
  },
  {
    title: "Implement Character Sheet MVP page in Angular 21",
    labels: ["mvp", "character-sheet", "ui", "angular"],
    body: `Implement the main Character Sheet MVP page in Angular 21.

## Suggested Components

- character-sheet-page
- character-identity-header
- equipment-panel
- equipment-slot
- loadout-selector
- inventory-panel
- inventory-item-row or inventory-item-card
- stat-summary
- stat-breakdown
- item-tooltip
- equipment-tooltip
- material-tooltip
- quest-item-tooltip
- junk-tooltip

## Layout

Top:
- identity header

Left:
- equipment
- loadouts

Center:
- combat math
- stat breakdown
- rotation preview placeholder

Right:
- inventory
- selected item details / compare

## Acceptance Criteria

- Page renders with mock data.
- Equipment panel works.
- Loadout selector works at MVP/local state level.
- Inventory panel works.
- Inventory actions work at MVP/local state level.
- Tooltips render.
- Stat math renders with green/red states.
- Angular components are reasonably separated.`,
  },
  {
    title: "Add tests for stat math, loadouts, and inventory actions",
    labels: ["mvp", "character-sheet", "testing", "stat-math", "loadouts", "inventory"],
    body: `Add tests for the Character Sheet MVP.

## Required Test Coverage

Stat math:
- buffed stat displays improved state
- nerfed stat displays reduced state
- inactive modifier is not counted
- source breakdown includes equipment source

Loadouts:
- active loadout can be switched
- item can be equipped into active loadout
- item can be unequipped from active loadout

Inventory:
- equipment item can be compared
- material quantity displays
- material quality stars display
- quest item uses correct tooltip family
- junk item uses correct tooltip family

## Acceptance Criteria

- Tests run through the project test command.
- Tests do not require backend.
- Mock data is used.
- Critical stat and loadout behavior is covered.`,
  },
  {
    title: "Document character sheet data and UI rules",
    labels: ["mvp", "character-sheet", "documentation"],
    body: `Add implementation documentation for Character Sheet MVP data and UI rules.

## Documentation Should Include

- character identity fields
- equipment slots
- loadout behavior
- inventory categories
- inventory actions
- stat math rules
- green/red number display
- tooltip families
- rarity visual treatment
- MVP non-goals

## Acceptance Criteria

- Documentation is committed under \`docs/\`.
- Documentation matches implemented MVP behavior.
- Future non-combat stats are mentioned as supported by model shape but not implemented.
- Angular 21 target is stated.`,
  },
];

console.log(`Repository: ${REPO_FULL_NAME}`);
console.log(`Project owner: ${PROJECT_OWNER}`);
console.log(`Project title: ${PROJECT_TITLE}`);
console.log("");

console.log("Creating missing labels...");
for (const [name, color, description] of labels) {
  createLabel(name, color, description);
}
console.log("✅ Labels processed.");
console.log("");

console.log("Creating/updating docs file...");
upsertRepoFile({
  path: "docs/character-sheet-mvp.md",
  content: docContent,
  message: "Add Character Sheet MVP design document",
});
console.log("");

console.log("Creating or finding GitHub Project...");
const projectNumber = createProject();
console.log("");

console.log("Creating issues...");
const createdIssueUrls = [];

for (const issue of issues) {
  try {
    const url = createIssue(issue);
    createdIssueUrls.push(url);
    console.log(`✅ Created issue: ${issue.title}`);
    console.log(`   ${url}`);

    if (projectNumber) {
      addIssueToProject(projectNumber, url);
    }
  } catch (error) {
    console.error(`❌ Failed to create issue: ${issue.title}`);
    const message = error?.stderr?.toString?.() || error.message;
    if (message) console.error(message.trim());
  }
}

console.log("");
console.log("Done.");
console.log(`Created ${createdIssueUrls.length} issues.`);

if (projectNumber) {
  console.log(`Project: ${PROJECT_TITLE} (#${projectNumber})`);
} else {
  console.log("Project was not created or not available. Issues were still created.");
}

console.log("");
console.log("Issue URLs:");
for (const url of createdIssueUrls) {
  console.log(`- ${url}`);
}