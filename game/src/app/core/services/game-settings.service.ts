import { Injectable, computed, inject, signal } from "@angular/core";
import {
  type ExperienceConfig,
  type PlayerDifficultyMode,
  type Skill
} from "@rinner/grayvale-core";
import { forkJoin } from "rxjs";

import {
  type AttributeDefinition,
  AttributeDefinitionsLoader
} from "../../data/loaders/attribute-definitions.loader";
import {
  type GameDifficultyCurves,
  DifficultyCurvesLoader
} from "../../data/loaders/difficulty-curves.loader";
import { SkillsLoader } from "../../data/loaders/skills.loader";

@Injectable({ providedIn: "root" })
export class GameSettingsService {
  private readonly difficultyCurvesLoader = inject(DifficultyCurvesLoader);
  private readonly attributeDefinitionsLoader = inject(AttributeDefinitionsLoader);
  private readonly skillsLoader = inject(SkillsLoader);

  private readonly difficultyCurvesState = signal<GameDifficultyCurves | null>(null);
  private readonly difficultyCurvesErrorState = signal<string | null>(null);
  private readonly attributeDefinitionsState = signal<readonly AttributeDefinition[]>([]);
  private readonly attributeDefinitionsErrorState = signal<string | null>(null);
  private readonly skillsState = signal<readonly Skill[]>([]);
  private readonly skillsErrorState = signal<string | null>(null);

  readonly difficultyCurves = this.difficultyCurvesState.asReadonly();
  readonly difficultyCurvesError = this.difficultyCurvesErrorState.asReadonly();
  readonly hasDifficultyCurves = computed(() => this.difficultyCurvesState() !== null);
  readonly attributeDefinitions = this.attributeDefinitionsState.asReadonly();
  readonly attributeDefinitionsError = this.attributeDefinitionsErrorState.asReadonly();
  readonly attributesById = computed(
    () => new Map(this.attributeDefinitionsState().map((attribute) => [attribute.id, attribute]))
  );
  readonly skills = this.skillsState.asReadonly();
  readonly skillsError = this.skillsErrorState.asReadonly();
  readonly skillsById = computed(
    () => new Map(this.skillsState().map((skill) => [skill.id, skill]))
  );

  constructor() {
    this.loadAll();
  }

  difficultyCurveFor(mode: PlayerDifficultyMode): ExperienceConfig | null {
    return this.difficultyCurvesState()?.[mode] ?? null;
  }

  attributeDefinitionFor(id: string): AttributeDefinition | null {
    return this.attributesById().get(id) ?? null;
  }

  skillDefinitionFor(id: string): Skill | null {
    return this.skillsById().get(id) ?? null;
  }

  reloadDifficultyCurves(): void {
    this.loadAll();
  }

  private loadAll(): void {
    forkJoin({
      curves: this.difficultyCurvesLoader.load(),
      attributes: this.attributeDefinitionsLoader.load(),
      skills: this.skillsLoader.load()
    }).subscribe({
      next: ({ curves, attributes, skills }) => {
        this.difficultyCurvesState.set(curves);
        this.difficultyCurvesErrorState.set(null);
        this.attributeDefinitionsState.set(attributes);
        this.attributeDefinitionsErrorState.set(null);
        this.skillsState.set(skills);
        this.skillsErrorState.set(null);
      },
      error: (error: unknown) => {
        this.difficultyCurvesState.set(null);
        this.difficultyCurvesErrorState.set(errorToMessage(error));
        this.attributeDefinitionsState.set([]);
        this.attributeDefinitionsErrorState.set(errorToMessage(error));
        this.skillsState.set([]);
        this.skillsErrorState.set(errorToMessage(error));
      }
    });
  }
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load game difficulty curves.";
}
