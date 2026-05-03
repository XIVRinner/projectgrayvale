import { Component, computed, effect, inject, input, output, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  type ExperienceConfig,
  type PlayerDifficultyMode,
  type Modifier,
  type Player,
  type Race,
  type RaceVariant,
  type Skill
} from "@rinner/grayvale-core";
import { forkJoin } from "rxjs";

import type { AttributeDefinition } from "../../data/loaders/attribute-definitions.loader";
import {
  CharacterCreatorOptions,
  CharacterCreatorOptionsLoader
} from "../../data/loaders/character-creator-options.loader";
import {
  CharacterNameLibrary,
  CharacterNameLibraryLoader
} from "../../data/loaders/character-name-library.loader";
import { CharacterRosterService } from "../../core/services/character-roster.service";
import { DebugLogService } from "../../core/services/game-log/debug-log.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
import {
  PLAYER_HEALTH_BALANCE_PROFILE_ID,
  reconcileHealthState
} from "../../core/services/health-balance";
import { safeParsePlayer } from "../../core/validation/core-runtime-validation";
import {
  CHARACTER_CREATOR_DEFAULT_GENDER_ID,
  CHARACTER_CREATOR_DIFFICULTY_DEFAULTS,
  CHARACTER_CREATOR_DIFFICULTY_OPTIONS,
  CHARACTER_CREATOR_GENDER_OPTIONS
} from "./character-creator.config";
import { CharacterCreatorViewComponent } from "./character-creator-view.component";
import {
  CharacterCreatorClassView,
  CharacterCreatorDifficultyOptionView,
  CharacterCreatorRaceView,
  CharacterCreatorViewState
} from "./character-creator.types";

@Component({
  selector: "gv-character-creator-container",
  imports: [CharacterCreatorViewComponent],
  template: `
    <gv-character-creator-view
      [state]="viewState()"
      [presentation]="presentation()"
      (nameChanged)="setName($event)"
      (genderChanged)="selectGender($event)"
      (raceChanged)="selectRace($event)"
      (classChanged)="selectClass($event)"
      (variantChanged)="selectVariant($event)"
      (portraitChanged)="selectPortrait($event)"
      (difficultyModeChanged)="selectDifficultyMode($event)"
      (expertModeChanged)="setExpertMode($event)"
      (ironmanModeChanged)="setIronmanMode($event)"
      (nameRandomizeRequested)="randomizeName()"
      (randomizeRequested)="randomize()"
      (createRequested)="createCharacter()"
    />
  `
})
export class CharacterCreatorContainerComponent {
  readonly presentation = input<"page" | "dialog">("page");
  readonly characterCreated = output<void>();

  private readonly optionsLoader = inject(CharacterCreatorOptionsLoader);
  private readonly nameLibraryLoader = inject(CharacterNameLibraryLoader);
  private readonly roster = inject(CharacterRosterService);
  private readonly debugLog = inject(DebugLogService);
  private readonly gameSettings = inject(GameSettingsService);

  private readonly options = signal<CharacterCreatorOptions | null>(null);
  private readonly nameLibrary = signal<CharacterNameLibrary>({});
  private readonly isLoading = signal(true);
  private readonly errorMessage = signal<string | null>(null);

  private readonly name = signal("");
  private readonly genderId = signal(CHARACTER_CREATOR_DEFAULT_GENDER_ID);
  private readonly raceId = signal("");
  private readonly classId = signal("");
  private readonly selectedVariant = signal<RaceVariant>("warm");
  private readonly selectedPortraitIndex = signal(0);
  private readonly selectedDifficultyMode = signal<PlayerDifficultyMode>(CHARACTER_CREATOR_DIFFICULTY_DEFAULTS.mode);
  private readonly expertMode = signal<boolean>(CHARACTER_CREATOR_DIFFICULTY_DEFAULTS.expert);
  private readonly ironmanMode = signal<boolean>(CHARACTER_CREATOR_DIFFICULTY_DEFAULTS.ironman);
  private readonly saveStatusMessage = signal<string | null>(null);

  private readonly selectedDifficultyOption = computed(() => {
    return CHARACTER_CREATOR_DIFFICULTY_OPTIONS.find((option) => option.id === this.selectedDifficultyMode()) ?? null;
  });

  private readonly selectedGenderOption = computed(() => {
    return CHARACTER_CREATOR_GENDER_OPTIONS.find((option) => option.id === this.genderId()) ?? null;
  });

  private readonly difficultyOptions = computed<readonly CharacterCreatorDifficultyOptionView[]>(() => {
    const normalCurve = this.gameSettings.difficultyCurveFor("normal");

    return CHARACTER_CREATOR_DIFFICULTY_OPTIONS.map((option) => ({
      ...option,
      statLines: buildDifficultyStatLines(
        this.gameSettings.difficultyCurveFor(option.id),
        normalCurve
      )
    }));
  });

  protected readonly viewState = computed<CharacterCreatorViewState>(() => {
    const options = this.options();

    return {
      isLoading: this.isLoading(),
      errorMessage: this.errorMessage(),
      name: this.name(),
      genderOptions: CHARACTER_CREATOR_GENDER_OPTIONS,
      selectedGenderId: this.genderId(),
      selectedGenderLabel: this.selectedGenderOption()?.label ?? null,
      raceOptions: this.raceOptions(),
      classOptions: this.classOptions(),
      selectedRaceId: this.raceId(),
      selectedClassId: this.classId(),
      selectedVariant: this.selectedVariant(),
      selectedPortraitIndex: this.selectedPortraitIndex(),
      selectedPortraitSrc: this.selectedPortraitSrc(),
      selectedDifficultyMode: this.selectedDifficultyMode(),
      difficultyOptions: this.difficultyOptions(),
      selectedDifficultyLabel: this.selectedDifficultyOption()?.label ?? null,
      expertMode: this.expertMode(),
      ironmanMode: this.ironmanMode(),
      availableVariants: this.availableVariants(),
      availablePortraits: this.availablePortraits(),
      previewPlayer: this.previewResult().player,
      previewError: this.previewResult().error,
      selectedRaceName: this.selectedRace()?.name ?? null,
      selectedRaceLore: this.selectedRaceView()?.loreSummary ?? null,
      selectedRaceBonusSummary: this.selectedRaceView()?.bonusSummary ?? null,
      selectedRaceMeta: this.selectedRaceView()?.meta ?? null,
      selectedClassName: this.selectedClass()?.name ?? null,
      selectedClassLore: this.selectedClassView()?.lore ?? null,
      selectedClassBonusSummary: this.selectedClassView()?.bonusSummary ?? null,
      selectedClassStatSummary: this.selectedClassView()?.statSummary ?? null,
      saveStatusMessage: this.saveStatusMessage()
    } satisfies CharacterCreatorViewState;
  });

  private readonly raceOptions = computed<readonly CharacterCreatorRaceView[]>(() => {
    const options = this.options();

    if (!options) {
      return [];
    }

    return options.races.map((race) => ({
      race,
      iconPath: raceIconPath(race.slug),
      bonusSummary: summarizeBonuses(
        race.startingBonuses,
        this.gameSettings.attributesById(),
        this.gameSettings.skillsById()
      ),
      loreSummary: `${race.name} lineage. ${summarizeBonuses(
        race.startingBonuses,
        this.gameSettings.attributesById(),
        this.gameSettings.skillsById()
      )}.`,
      meta: buildRaceMeta(race),
      statSummary: summarizeModifierStats(
        race.startingBonuses,
        this.gameSettings.attributesById(),
        this.gameSettings.skillsById()
      )
    }));
  });

  private readonly classOptions = computed<readonly CharacterCreatorClassView[]>(() => {
    const options = this.options();

    if (!options) {
      return [];
    }

    return options.classes.map((option) => ({
      option,
      bonusSummary: option.bonusSummary,
      lore: option.lore,
      bonusLines: summarizeClassBonuses(
        option,
        this.gameSettings.attributesById(),
        this.gameSettings.skillsById()
      ),
      statSummary: summarizeTopAttributes(option.baseAttributes, this.gameSettings.attributesById())
    }));
  });

  private readonly selectedRace = computed<Race | null>(() => {
    const options = this.options();

    if (!options) {
      return null;
    }

    return options.races.find((race) => race.id === this.raceId()) ?? null;
  });

  private readonly selectedClass = computed<CharacterCreatorOptions["classes"][number] | null>(() => {
    const options = this.options();

    if (!options) {
      return null;
    }

    return options.classes.find((value) => value.id === this.classId()) ?? null;
  });

  private readonly selectedRaceView = computed<CharacterCreatorRaceView | null>(() => {
    return this.raceOptions().find((entry) => entry.race.id === this.raceId()) ?? null;
  });

  private readonly selectedClassView = computed<CharacterCreatorClassView | null>(() => {
    return this.classOptions().find((entry) => entry.option.id === this.classId()) ?? null;
  });

  private readonly availableVariants = computed<readonly RaceVariant[]>(() => {
    const race = this.selectedRace();

    if (!race?.variants) {
      return [];
    }

    const variants: RaceVariant[] = [];

    if ((race.variants.warm?.length ?? 0) > 0) {
      variants.push("warm");
    }

    if ((race.variants.cool?.length ?? 0) > 0) {
      variants.push("cool");
    }

    if ((race.variants.exotic?.length ?? 0) > 0) {
      variants.push("exotic");
    }

    return variants;
  });

  private readonly availablePortraits = computed<readonly string[]>(() => {
    const race = this.selectedRace();

    if (!race?.variants) {
      return [];
    }

    return race.variants[this.selectedVariant()] ?? [];
  });

  private readonly selectedPortraitSrc = computed(() => {
    const race = this.selectedRace();
    const portraits = this.availablePortraits();
    const portraitName = portraits[this.selectedPortraitIndex()];

    if (!race || !portraitName) {
      return null;
    }

    return `${race.imageBasePath}/${this.selectedVariant()}/${portraitName}`;
  });

  private readonly previewResult = computed<{ player: Player | null; error: string | null }>(() => {
    const race = this.selectedRace();
    const classOption = this.selectedClass();
    const options = this.options();

    if (!options || !race || !classOption) {
      return { player: null, error: null };
    }

    const normalizedName = this.name().trim();

    if (normalizedName.length === 0) {
      return {
        player: null,
        error: "Name is required before a valid character profile can be generated."
      };
    }

    const playerDraft: Player = {
      id: buildPlayerId(normalizedName),
      name: normalizedName,
      description: "A newly registered adventurer entering GrayVale.",
      raceId: race.id,
      jobClass: classOption.id,
      progression: {
        level: options.defaults.progression.level,
        experience: options.defaults.progression.experience
      },
      adventurerRank: options.defaults.adventurerRank,
      difficulty: {
        mode: this.selectedDifficultyMode(),
        expert: this.expertMode(),
        ironman: this.ironmanMode()
      },
      genderId: this.genderId(),
      attributes: applyBonuses(classOption.baseAttributes, race.startingBonuses),
      skills: buildStartingSkills(
        classOption.baseSkills,
        race.startingBonuses,
        this.gameSettings.skillsById()
      ),
      selectedAppearance: {
        variant: this.selectedVariant(),
        imageIndex: this.selectedPortraitIndex()
      },
      inventory: {
        items: {}
      },
      equippedItems: {}
    };

    const validation = safeParsePlayer(playerDraft);

    if (!validation.success) {
      return {
        player: null,
        error: validation.error
      };
    }

    return {
      player: validation.data,
      error: null
    };
  });

  constructor() {
    forkJoin({
      options: this.optionsLoader.load(),
      nameLibrary: this.nameLibraryLoader.load()
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ options, nameLibrary }) => {
          this.debugLog.logMessage("creator", "Character creator data loaded.", {
            raceCount: options.races.length,
            classCount: options.classes.length
          });
          this.options.set(options);
          this.nameLibrary.set(nameLibrary);
          this.seedFromDefaults(options);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.debugLog.logMessage("creator", "Character creator failed to load.", errorToString(error));
          this.errorMessage.set(errorToString(error));
          this.isLoading.set(false);
        }
      });

    effect(() => {
      const variants = this.availableVariants();
      const portraits = this.availablePortraits();

      if (variants.length === 0) {
        return;
      }

      if (!variants.includes(this.selectedVariant())) {
        this.selectedVariant.set(variants[0]);
      }

      if (this.selectedPortraitIndex() >= portraits.length) {
        this.selectedPortraitIndex.set(0);
      }
    });
  }

  protected setName(value: string): void {
    this.name.set(value);
  }

  protected selectGender(genderId: string): void {
    this.genderId.set(genderId);
  }

  protected randomizeName(): void {
    const race = this.selectedRace();
    const fallbackSlug = this.options()?.races.find((entry) => entry.id === this.raceId())?.slug ?? "human";
    this.name.set(this.generateName(race?.slug ?? fallbackSlug));
    this.debugLog.logMessage("creator", "Randomized character name.", {
      raceId: race?.id ?? this.raceId(),
      name: this.name()
    });
    this.saveStatusMessage.set(null);
  }

  protected selectRace(raceId: string): void {
    this.raceId.set(raceId);
    this.selectedPortraitIndex.set(0);
  }

  protected selectClass(classId: string): void {
    this.classId.set(classId);
  }

  protected selectVariant(variant: RaceVariant): void {
    this.selectedVariant.set(variant);
    this.selectedPortraitIndex.set(0);
  }

  protected selectPortrait(index: number): void {
    this.selectedPortraitIndex.set(index);
  }

  protected selectDifficultyMode(mode: PlayerDifficultyMode): void {
    this.selectedDifficultyMode.set(mode);
  }

  protected setExpertMode(value: boolean): void {
    this.expertMode.set(value);
  }

  protected setIronmanMode(value: boolean): void {
    this.ironmanMode.set(value);
  }

  protected randomize(): void {
    const options = this.options();

    if (!options) {
      return;
    }

    const race = options.races[randomIndex(options.races.length)];
    const classOption = options.classes[randomIndex(options.classes.length)];
    const variants = extractVariants(race);
    const variant = variants[randomIndex(variants.length)] ?? "warm";
    const portraits = race.variants?.[variant] ?? [];

    this.raceId.set(race.id);
    this.classId.set(classOption.id);
    this.selectedVariant.set(variant);
    this.selectedPortraitIndex.set(randomIndex(portraits.length));
    this.selectedDifficultyMode.set(randomDifficultyMode());
    this.expertMode.set(Math.random() >= 0.5);
    this.ironmanMode.set(Math.random() >= 0.5);
    this.genderId.set(randomGenderId());
    this.name.set(this.generateName(race.slug));
    this.debugLog.logMessage("creator", "Randomized character draft.", {
      raceId: race.id,
      classId: classOption.id,
      difficultyMode: this.selectedDifficultyMode(),
      name: this.name()
    });
    this.saveStatusMessage.set(null);
  }

  protected createCharacter(): void {
    const previewPlayer = this.previewResult().player;

    if (!previewPlayer) {
      this.debugLog.logMessage(
        "creator",
        "Create character ignored because the preview player was invalid.",
        this.previewResult().error
      );
      return;
    }

    const savedSlot = this.roster.createCharacter(
      previewPlayer,
      reconcileHealthState(
        previewPlayer,
        undefined,
        this.gameSettings.balanceProfileFor(PLAYER_HEALTH_BALANCE_PROFILE_ID) ?? undefined
      )
    );
    this.debugLog.logMessage("creator", "Created character save slot.", {
      slotId: savedSlot.id,
      playerId: previewPlayer.id,
      playerName: previewPlayer.name
    });
    this.saveStatusMessage.set(`Saved to ${savedSlot.id.replace("_", " ").toUpperCase()}.`);
    this.characterCreated.emit();
  }

  private seedFromDefaults(options: CharacterCreatorOptions): void {
    this.raceId.set(options.defaults.raceId);
    this.classId.set(options.defaults.classId);
    this.selectedVariant.set(options.defaults.appearanceVariant);
    this.selectedPortraitIndex.set(options.defaults.appearanceIndex);
    this.selectedDifficultyMode.set(CHARACTER_CREATOR_DIFFICULTY_DEFAULTS.mode);
    this.expertMode.set(CHARACTER_CREATOR_DIFFICULTY_DEFAULTS.expert);
    this.ironmanMode.set(CHARACTER_CREATOR_DIFFICULTY_DEFAULTS.ironman);
    this.genderId.set(CHARACTER_CREATOR_DEFAULT_GENDER_ID);
    const defaultRace = options.races.find((race) => race.id === options.defaults.raceId);
    this.name.set(this.generateName(defaultRace?.slug ?? "human"));
    this.saveStatusMessage.set(null);
  }

  private generateName(raceSlug: string): string {
    const names = this.nameLibrary()[raceSlug] ?? this.nameLibrary()["human"] ?? [];

    if (names.length === 0) {
      return "Unnamed Wanderer";
    }

    return names[randomIndex(names.length)] ?? "Unnamed Wanderer";
  }
}

function extractVariants(race: Race): RaceVariant[] {
  const variants: RaceVariant[] = [];

  if ((race.variants?.warm?.length ?? 0) > 0) {
    variants.push("warm");
  }

  if ((race.variants?.cool?.length ?? 0) > 0) {
    variants.push("cool");
  }

  if ((race.variants?.exotic?.length ?? 0) > 0) {
    variants.push("exotic");
  }

  return variants;
}

function raceIconPath(slug: string): string {
  const iconBySlug: Record<string, string> = {
    human: "assets/images/character/race-icons/human.png",
    elven: "assets/images/character/race-icons/elf.png",
    "high-goblin": "assets/images/character/race-icons/highgoblin.png",
    "night-elf": "assets/images/character/race-icons/nelf.png",
    oni: "assets/images/character/race-icons/oni.png",
    catfolk: "assets/images/character/race-icons/catfolk.svg",
    golem: "assets/images/character/race-icons/golem.svg"
  };

  return iconBySlug[slug] ?? iconBySlug["human"];
}

function summarizeBonuses(
  bonuses: readonly Modifier[] | undefined,
  attributesById: ReadonlyMap<string, AttributeDefinition>,
  skillsById: ReadonlyMap<string, Skill>
): string {
  if (!bonuses || bonuses.length === 0) {
    return "No starting stat bonus";
  }

  return bonuses
    .map((bonus) => `${bonus.type === "add" ? "+" : "x"}${bonus.value} ${resolveStatLabel(bonus.stat, attributesById, skillsById)}`)
    .join(" | ");
}

function summarizeClassBonuses(
  option: CharacterCreatorOptions["classes"][number],
  attributesById: ReadonlyMap<string, AttributeDefinition>,
  skillsById: ReadonlyMap<string, Skill>
): readonly string[] {
  const skillBonuses = Object.entries(option.baseSkills)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, value]) => `${resolveSkillLabel(skill, skillsById)} +${value}`);
  const topAttributes = summarizeTopAttributes(option.baseAttributes, attributesById);

  const lines: string[] = [];

  if (skillBonuses.length > 0) {
    lines.push(`Starts with: ${skillBonuses.join(" | ")}`);
  }

  if (topAttributes.length > 0) {
    lines.push(`Strong stats: ${topAttributes}`);
  }

  return lines;
}

function summarizeTopAttributes(
  attributes: Readonly<Record<string, number>>,
  attributesById: ReadonlyMap<string, AttributeDefinition>
): string {
  return Object.entries(attributes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([attribute, value]) => `${resolveAttributeLabel(attribute, attributesById)} ${value}`)
    .join(" | ");
}

function prettyLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRaceMeta(race: Race): string {
  const warmCount = race.variants?.warm?.length ?? 0;
  const coolCount = race.variants?.cool?.length ?? 0;
  const exoticCount = race.variants?.exotic?.length ?? 0;
  const totalPortraits = warmCount + coolCount + exoticCount;
  const variantCount = [warmCount, coolCount, exoticCount].filter((count) => count > 0).length;

  if (totalPortraits <= 0) {
    return "No portraits";
  }

  return `${totalPortraits} portraits • ${variantCount} variant${variantCount === 1 ? "" : "s"}`;
}

function summarizeModifierStats(
  modifiers: readonly Modifier[] | undefined,
  attributesById: ReadonlyMap<string, AttributeDefinition>,
  skillsById: ReadonlyMap<string, Skill>
): string {
  if (!modifiers || modifiers.length === 0) {
    return "No lineage modifiers";
  }

  return modifiers
    .map((modifier) => resolveStatLabel(modifier.stat, attributesById, skillsById))
    .join(" | ");
}

function applyBonuses(
  attributes: Readonly<Record<string, number>>,
  modifiers: readonly Modifier[] | undefined
): Record<string, number> {
  const result: Record<string, number> = { ...attributes };

  if (!modifiers) {
    return result;
  }

  for (const modifier of modifiers) {
    const currentValue = result[modifier.stat] ?? 0;

    if (modifier.type === "add") {
      result[modifier.stat] = currentValue + modifier.value;
      continue;
    }

    result[modifier.stat] = Math.round(currentValue * modifier.value);
  }

  return result;
}

function buildStartingSkills(
  baseSkills: Readonly<Record<string, number>>,
  modifiers: readonly Modifier[] | undefined,
  skillsById: ReadonlyMap<string, Skill>
): Record<string, number> {
  const result: Record<string, number> = {};
  const referencedSkills = new Set<string>(Object.keys(baseSkills));

  for (const modifier of modifiers ?? []) {
    if (skillsById.has(modifier.stat)) {
      referencedSkills.add(modifier.stat);
    }
  }

  for (const skillId of referencedSkills) {
    result[skillId] = 1;
  }

  for (const [skillId, value] of Object.entries(baseSkills)) {
    result[skillId] = Math.max(1, value);
  }

  for (const modifier of modifiers ?? []) {
    if (!skillsById.has(modifier.stat)) {
      continue;
    }

    const currentValue = result[modifier.stat] ?? 1;

    if (modifier.type === "add") {
      result[modifier.stat] = currentValue + modifier.value;
      continue;
    }

    result[modifier.stat] = Math.max(1, Math.round(currentValue * modifier.value));
  }

  return result;
}

function resolveStatLabel(
  statId: string,
  attributesById: ReadonlyMap<string, AttributeDefinition>,
  skillsById: ReadonlyMap<string, Skill>
): string {
  if (attributesById.has(statId)) {
    return resolveAttributeLabel(statId, attributesById);
  }

  return resolveSkillLabel(statId, skillsById);
}

function resolveAttributeLabel(
  attributeId: string,
  attributesById: ReadonlyMap<string, AttributeDefinition>
): string {
  return attributesById.get(attributeId)?.name ?? prettyLabel(attributeId);
}

function resolveSkillLabel(skillId: string, skillsById: ReadonlyMap<string, Skill>): string {
  return skillsById.get(skillId)?.name ?? prettyLabel(skillId);
}

function buildPlayerId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `player_${slug || "new_recruit"}`;
}

function randomIndex(length: number): number {
  if (length <= 1) {
    return 0;
  }

  return Math.floor(Math.random() * length);
}

function randomDifficultyMode(): PlayerDifficultyMode {
  const modes = CHARACTER_CREATOR_DIFFICULTY_OPTIONS.map((option) => option.id);

  return modes[randomIndex(modes.length)] ?? "normal";
}

function randomGenderId(): string {
  const genderIds = CHARACTER_CREATOR_GENDER_OPTIONS.map((option) => option.id);

  return genderIds[randomIndex(genderIds.length)] ?? CHARACTER_CREATOR_DEFAULT_GENDER_ID;
}

function buildDifficultyStatLines(
  selectedCurve: ExperienceConfig | null,
  normalCurve: ExperienceConfig | null
): readonly string[] {
  if (!selectedCurve || !normalCurve) {
    return [];
  }

  return [
    `Base XP ${formatNumber(selectedCurve.baseXp)} (${formatSignedDelta(selectedCurve.baseXp - normalCurve.baseXp)})`,
    `Growth ${selectedCurve.growthFactor.toFixed(2)} (${formatSignedDelta(selectedCurve.growthFactor - normalCurve.growthFactor)})`,
    `Exponent ${selectedCurve.exponent.toFixed(2)} (${formatSignedDelta(selectedCurve.exponent - normalCurve.exponent)})`
  ];
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatSignedDelta(value: number): string {
  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2).replace(/\.00$/, "")}`;
}

function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load character creator options.";
}
