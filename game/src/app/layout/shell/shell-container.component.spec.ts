import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { samplePlayer, type ActivityDefinition } from "@rinner/grayvale-core";
import { of } from "rxjs";

import { ActivitiesLoader } from "../../data/loaders/activities.loader";
import type { CharacterCreatorOptions } from "../../data/loaders/character-creator-options.loader";
import { CharacterCreatorOptionsLoader } from "../../data/loaders/character-creator-options.loader";
import { CharacterRosterService } from "../../core/services/character-roster.service";
import { GameDialogService } from "../../core/services/game-dialog.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
import { WorldStateService } from "../../core/services/world-state.service";

import { ShellContainerComponent } from "./shell-container.component";

describe("ShellContainerComponent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows the single Wake up action before the prologue completes", async () => {
    const { component } = await createFixture();

    expect(component.actionGroups()).toEqual([
      {
        kind: "talk",
        label: "TALK",
        themeKey: "talk",
        choices: [
          {
            id: "story:wake-up",
            label: "Wake up"
          }
        ]
      }
    ]);
  });

  it("switches to disabled Recover after prologue completion and forwards Wake up clicks to the dialog service", async () => {
    const { component, roster, gameDialog } = await createFixture();

    (component as any).handleActionSelected("story:wake-up");
    expect(gameDialog.startPrologue).toHaveBeenCalledTimes(1);

    roster.applyActiveCharacterDeltas([
      {
        type: "set",
        target: "player",
        path: ["story", "currentChapter"],
        value: 2
      },
      {
        type: "set",
        target: "player",
        path: ["activityState", "availability", "recover", "status"],
        value: "disabled"
      },
      {
        type: "set",
        target: "player",
        path: ["activityState", "availability", "recover", "disabledReason"],
        value: "You are still too injured to recover properly."
      }
    ]);

    expect(component.actionGroups()).toEqual([
      {
        kind: "movement",
        label: "MOVEMENT",
        themeKey: "movement",
        choices: [
          {
            id: "leave-chief-house",
            label: "Leave chief house"
          }
        ]
      },
      {
        kind: "activity",
        label: "ACTIVITY",
        themeKey: "activity",
        choices: [
          {
            id: "activity:recover",
            label: "Recover",
            disabled: true,
            disabledReason: "You are still too injured to recover properly."
          }
        ]
      }
    ]);
  });

  it("renders persisted HP data through the shell health bar", async () => {
    const { component, roster } = await createFixture();

    roster.updateActiveHealth({
      currentHp: 31,
      maxHp: 52
    });

    expect(component.characterPanel().progressBars[0]).toMatchObject({
      label: "Health",
      valueLabel: "31 / 52",
      current: 31,
      max: 52,
      tone: "health"
    });
  });

  it("scales the experience bar from the active difficulty curve", async () => {
    const { component, roster, gameSettings } = await createFixture();

    expect(component.characterPanel().progressBars[1]).toMatchObject({
      label: "Experience",
      valueLabel: "145 / 529 XP",
      current: 145,
      max: 529,
      tone: "experience",
      detail: "384 XP to Level 4"
    });
    expect(component.characterPanel().progressBars[1].gapWarning).toBeUndefined();
    expect(gameSettings.difficultyCurveFor).toHaveBeenCalledWith("normal");

    roster.applyActiveCharacterDeltas([
      {
        type: "set",
        target: "player",
        path: ["difficulty", "mode"],
        value: "hard"
      }
    ]);

    expect(component.characterPanel().progressBars[1]).toMatchObject({
      label: "Experience",
      valueLabel: "145 / 870 XP",
      current: 145,
      max: 870,
      tone: "experience",
      detail: "725 XP to Level 4"
    });
    expect(gameSettings.difficultyCurveFor).toHaveBeenCalledWith("hard");
  });
});

async function createFixture(): Promise<{
  component: ShellContainerComponent;
  roster: CharacterRosterService;
  gameDialog: {
    session: ReturnType<typeof signal<null>>;
    startPrologue: jest.Mock;
    advance: jest.Mock;
    choose: jest.Mock;
  };
  gameSettings: {
    balanceProfileFor: jest.Mock;
    difficultyCurveFor: jest.Mock;
    attributesById: ReturnType<typeof signal<Map<string, never>>>;
    skillsById: ReturnType<typeof signal<Map<string, never>>>;
  };
}> {
  const roster = new CharacterRosterService();
  const player = clonePlayer(samplePlayer);

  player.story = {
    currentArcId: "prologue",
    currentChapter: 1
  };
  player.activityState = {
    availability: {},
    activeActivityId: null
  };
  roster.createCharacter(player);

  const activities: readonly ActivityDefinition[] = [
    {
      id: "recover",
      name: "Recover",
      description: "Steady your breathing and let the worst of the pain pass.",
      tags: ["recovery", "rest"],
      governingAttributes: ["vitality"],
      difficulty: 5
    }
  ];
  const creatorOptions: CharacterCreatorOptions = {
    races: [],
    classes: [],
    defaults: {
      raceId: "race_human",
      classId: "wanderer",
      appearanceVariant: "warm",
      appearanceIndex: 0,
      adventurerRank: 1,
      progression: {
        level: 1,
        experience: 0
      }
    }
  };
  const gameDialog = {
    session: signal(null),
    startPrologue: jest.fn(),
    advance: jest.fn(),
    choose: jest.fn()
  };
  const gameSettings = {
    balanceProfileFor: jest.fn(() => ({
      id: "player_health_v1",
      scalars: {
        attributes: {
          vitality: 4
        },
        resources: {
          maxHpFlat: 20
        }
      }
    })),
    difficultyCurveFor: jest.fn((mode: "easy" | "normal" | "hard") => {
      if (mode === "easy") {
        return {
          baseXp: 100,
          growthFactor: 1,
          exponent: 1.1
        };
      }

      if (mode === "hard") {
        return {
          baseXp: 100,
          growthFactor: 1.5,
          exponent: 1.6
        };
      }

      return {
        baseXp: 100,
        growthFactor: 1.2,
        exponent: 1.35
      };
    }),
    attributesById: signal(new Map()),
    skillsById: signal(new Map())
  };

  await TestBed.configureTestingModule({
    imports: [ShellContainerComponent],
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: ActivitiesLoader, useValue: { load: () => of(activities) } },
      {
        provide: CharacterCreatorOptionsLoader,
        useValue: { load: () => of(creatorOptions) }
      },
      { provide: GameDialogService, useValue: gameDialog },
      {
        provide: GameSettingsService,
        useValue: gameSettings
      },
      {
        provide: WorldStateService,
        useValue: {
          currentLocationLabel: signal("Arkama Village"),
          currentSublocationLabel: signal("Chief House"),
          loadError: signal<string | null>(null),
          actionGroups: signal([
            {
              kind: "movement",
              label: "MOVEMENT",
              themeKey: "movement",
              choices: [
                {
                  id: "leave-chief-house",
                  label: "Leave chief house"
                }
              ]
            }
          ])
        }
      }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(ShellContainerComponent);
  fixture.detectChanges();

  return {
    roster,
    gameDialog,
    gameSettings,
    component: fixture.componentInstance
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
