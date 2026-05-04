import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { samplePlayer, type Quest } from "@rinner/grayvale-core";
import { of, Subject } from "rxjs";

import type { CharacterCreatorOptions } from "../../data/loaders/character-creator-options.loader";
import { CharacterCreatorOptionsLoader } from "../../data/loaders/character-creator-options.loader";
import { CharacterRosterService } from "../../core/services/character-roster.service";
import { GameDialogService } from "../../core/services/game-dialog.service";
import { GameQuestService } from "../../core/services/game-quest.service";
import { GameSettingsService } from "../../core/services/game-settings.service";
import { WorldStateService } from "../../core/services/world-state.service";
import { GameplayGraphRuntime } from "../../core/execution-graph/gameplay-graph-runtime.service";
import { QuestsLoader } from "../../data/loaders/quests.loader";

import { ShellContainerComponent } from "./shell-container.component";

describe("ShellContainerComponent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows the single Wake up action before the prologue completes", async () => {
    const { component, setRuntimeActionGroups, fixture } = await createFixture();

    setRuntimeActionGroups([
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
    fixture.detectChanges();

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

  it("enables the Gameplay Log topbar action and updates its badge from gameplay entries", async () => {
    const { component, fixture, roster } = await createFixture();

    expect(component.topbarActions()[0]).toEqual({
      id: "topbar:gameplay-log",
      label: "Gameplay Log",
      icon: "pi pi-list",
      badge: undefined,
      tone: "default"
    });

    roster.applyActiveCharacterDeltas([
      {
        type: "set",
        target: "player",
        path: ["questLog", "quests", "quest_recovery"],
        value: {
          currentStep: "runtime_objectives",
          status: "active"
        }
      }
    ]);
    fixture.detectChanges();

    expect(component.topbarActions()[0]).toEqual({
      id: "topbar:gameplay-log",
      label: "Gameplay Log",
      icon: "pi pi-list",
      badge: 1,
      tone: "default"
    });
  });

  it("opens the gameplay log in the special dialog from the topbar action", async () => {
    const { component, fixture, roster } = await createFixture();

    roster.applyActiveCharacterDeltas([
      {
        type: "add",
        target: "player",
        path: ["inventory", "items", "ore_chunk"],
        value: 2
      }
    ]);
    fixture.detectChanges();

    (component as any).handleTopbarActionSelected("topbar:gameplay-log");
    fixture.detectChanges();

    expect((component as any).isGameplayLogOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain("Gameplay Log");
    expect(fixture.nativeElement.textContent).toContain("Received Ore Chunk x2");
    expect(fixture.nativeElement.textContent).toContain("Runtime Trace");
    expect(fixture.nativeElement.textContent).toContain("Topbar action selected.");
    expect(fixture.nativeElement.querySelector('[data-width="log"]')).not.toBeNull();
  });

  it("starts the recovery quest after prologue and forwards Wake up clicks to the dialog service", async () => {
    const { component, roster, gameDialog, gameQuests } = await createFixture();

    (component as any).handleActionSelected("story:wake-up");
    expect(gameDialog.startPrologue).toHaveBeenCalledTimes(1);

    roster.applyActiveCharacterDeltas([
      {
        type: "set",
        target: "player",
        path: ["story", "currentChapter"],
        value: 2
      }
    ]);
    expect(gameQuests.startQuestById("quest_recovery")).toBe(true);

    expect(component.actionGroups()).toEqual([
      {
        kind: "movement",
        label: "MOVEMENT",
        themeKey: "movement",
        choices: [
          {
            id: "leave-chief-house",
            label: "Leave chief house",
            disabled: undefined,
            disabledReason: undefined
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
            disabled: false,
            disabledReason: undefined
          }
        ]
      }
    ]);
    expect(component.questTrackerPanel()).toEqual({
      title: "Quest Tracker",
      emptyLabel: "No active quests. Story and field work will appear here when they are underway.",
      entries: [
        {
          id: "quest_recovery",
          title: "Recovery",
          status: "active",
          summary: "8.0 / 10.0",
          objectives: [
            {
              id: "quest_recovery:0",
              label: "Vitality",
              progressLabel: "8.0 / 10.0",
              completed: false
            }
          ]
        }
      ]
    });
  });

  it("applies recover activity vitality gains and hides recover once the quest completes", async () => {
    const { component, roster, gameQuests, setRuntimeActionGroups, fixture } = await createFixture();

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
        path: ["attributes", "vitality"],
        value: 8
      }
    ]);
    gameQuests.startQuestById("quest_recovery");

    (component as any).handleActionSelected("activity:recover");
    expect(roster.activeCharacter()?.attributes["vitality"]).toBe(9);

    (component as any).handleActionSelected("activity:recover");
    expect(roster.activeCharacter()?.attributes["vitality"]).toBe(10);
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "locked"
    });

    // Simulate runtime removing recover from action groups (activity locked)
    setRuntimeActionGroups([
      {
        kind: "movement",
        label: "MOVEMENT",
        themeKey: "movement",
        choices: [
          {
            id: "leave-chief-house",
            label: "Leave chief house",
            disabled: undefined,
            disabledReason: undefined
          }
        ]
      }
    ]);
    fixture.detectChanges();

    expect(component.actionGroups()).toEqual([
      {
        kind: "movement",
        label: "MOVEMENT",
        themeKey: "movement",
        choices: [
          {
            id: "leave-chief-house",
            label: "Leave chief house",
            disabled: undefined,
            disabledReason: undefined
          }
        ]
      }
    ]);
    expect(component.questTrackerPanel()).toEqual({
      title: "Quest Tracker",
      emptyLabel: "No active quests. Story and field work will appear here when they are underway.",
      entries: []
    });
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
  fixture: ReturnType<typeof TestBed.createComponent<ShellContainerComponent>>;
  component: ShellContainerComponent;
  roster: CharacterRosterService;
  gameDialog: {
    session: ReturnType<typeof signal<null>>;
    events$: Subject<unknown>;
    startPrologue: jest.Mock;
    advance: jest.Mock;
    choose: jest.Mock;
  };
  gameQuests: GameQuestService;
  gameSettings: {
    balanceProfileFor: jest.Mock;
    difficultyCurveFor: jest.Mock;
    attributesById: ReturnType<typeof signal<Map<string, never>>>;
    skillsById: ReturnType<typeof signal<Map<string, never>>>;
  };
  setRuntimeActionGroups: (groups: ReturnType<typeof signal>[0]) => void;
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
  player.attributes["vitality"] = 8;
  if (player.questLog) {
    delete player.questLog.quests["quest_recovery"];
  }
  roster.createCharacter(player);

  const quests: readonly Quest[] = [
    {
      id: "quest_recovery",
      objectives: [
        {
          type: "attribute_reached",
          attribute: "vitality",
          target: 10
        }
      ]
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
    events$: new Subject(),
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

  const gameplayRuntimeActionGroups = signal([
    {
      kind: "movement" as const,
      label: "MOVEMENT",
      themeKey: "movement" as const,
      choices: [
        {
          id: "leave-chief-house",
          label: "Leave chief house"
        }
      ]
    }
  ]);

  await TestBed.configureTestingModule({
    imports: [ShellContainerComponent],
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: QuestsLoader, useValue: { load: () => of(quests) } },
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
          loadError: signal<string | null>(null)
        }
      },
      {
        provide: GameplayGraphRuntime,
        useFactory: (gameQuests: GameQuestService) => ({
          isReady: signal(true),
          actionGroups: gameplayRuntimeActionGroups,
          debugSnapshot: signal(null),
          executeAction: (actionId: string) => {
            if (actionId.startsWith("activity:")) {
              const activityId = actionId.slice("activity:".length);
              gameQuests.executeActivityById(activityId);
              return { ok: true, actionId };
            }

            return { ok: true, actionId };
          }
        }),
        deps: [GameQuestService]
      }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(ShellContainerComponent);
  fixture.detectChanges();
  const gameQuests = TestBed.inject(GameQuestService);

  return {
    fixture,
    roster,
    gameDialog,
    gameQuests,
    gameSettings,
    setRuntimeActionGroups: (groups) => gameplayRuntimeActionGroups.set(groups as never),
    component: fixture.componentInstance
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
