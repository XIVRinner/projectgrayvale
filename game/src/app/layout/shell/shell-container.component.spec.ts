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
        label: "Story",
        tone: "talk",
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
        label: "Local",
        tone: "travel",
        choices: [
          {
            id: "leave-chief-house",
            label: "Leave chief house"
          }
        ]
      },
      {
        label: "Recovery",
        tone: "activity",
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
        useValue: {
          difficultyCurveFor: jest.fn(() => null),
          attributesById: signal(new Map()),
          skillsById: signal(new Map())
        }
      },
      {
        provide: WorldStateService,
        useValue: {
          currentLocationLabel: signal("Arkama Village"),
          currentSublocationLabel: signal("Chief House"),
          loadError: signal<string | null>(null),
          actionGroups: signal([
            {
              label: "Local",
              tone: "travel",
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
    component: fixture.componentInstance
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
