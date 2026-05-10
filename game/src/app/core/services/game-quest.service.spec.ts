import { TestBed } from "@angular/core/testing";
import { samplePlayer, type Quest } from "@rinner/grayvale-core";
import { of, Subject } from "rxjs";

import { ActivitiesLoader } from "../../data/loaders/activities.loader";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import { QuestsLoader } from "../../data/loaders/quests.loader";
import { CharacterRosterService } from "./character-roster.service";
import { GameQuestService } from "./game-quest.service";
import type { GameQuestEvent } from "./game-quest.types";
import { QuestTracker } from "./quest-tracker/quest-tracker";

describe("GameQuestService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts the recovery quest, enables recover, and completes it at 10.0 vitality", () => {
    const { roster, service } = createFixture();
    const questEvents: GameQuestEvent[] = [];
    const player = clonePlayer(samplePlayer);

    service.events$.subscribe((event) => {
      questEvents.push(event);
    });

    player.attributes.vitality = 8;
    delete player.questLog;
    player.story = {
      currentArcId: "prologue",
      currentChapter: 1
    };
    player.activityState = {
      availability: {},
      activeActivityId: null
    };

    roster.createCharacter(player);

    expect(service.startQuestById("quest_recovery")).toBe(true);
    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "active"
    });
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "enabled"
    });
    expect(questEvents.filter((event) => event.type === "quest-started")).toEqual([
      {
        type: "quest-started",
        questId: "quest_recovery",
        message: "Quest received: reach 10.0 Vitality."
      }
    ]);
    expect(service.latestQuestMessage()).toBe("Quest received: reach 10.0 Vitality.");

    expect(service.executeActivityById("recover")).toBe(true);
    expect(roster.activeCharacter()?.attributes["vitality"]).toBe(9);
    expect(service.latestAttributeMessage()).toBe("Vitality +1.0 -> 9.0");

    expect(service.executeActivityById("recover")).toBe(true);
    expect(roster.activeCharacter()?.attributes["vitality"]).toBe(10);
    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "completed",
      completedSteps: ["runtime_objectives"]
    });
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "locked"
    });
    expect(service.latestQuestMessage()).toBe(
      "Quest complete: reach 10.0 Vitality Reward: Recover hidden, Strength unlocked."
    );
    expect(questEvents.filter((event) => event.type === "quest-completed")).toEqual([
      {
        type: "quest-completed",
        questId: "quest_recovery",
        message: "Quest complete: reach 10.0 Vitality Reward: Recover hidden, Strength unlocked."
      }
    ]);
  });

  it("queues quest starts requested before quests.json finishes loading", () => {
    const questsSubject = new Subject<readonly Quest[]>();
    const { roster, service } = createFixture({
      questsLoad: () => questsSubject.asObservable()
    });
    const questEvents: GameQuestEvent[] = [];
    const player = clonePlayer(samplePlayer);

    service.events$.subscribe((event) => {
      questEvents.push(event);
    });

    player.attributes.vitality = 8;
    delete player.questLog;
    player.story = {
      currentArcId: "prologue",
      currentChapter: 2
    };
    player.activityState = {
      availability: {},
      activeActivityId: null
    };

    roster.createCharacter(player);

    expect(service.startQuestById("quest_recovery")).toBe(true);
    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toBeUndefined();

    questsSubject.next([
      {
        id: "quest_recovery",
        startRewards: [
          {
            type: "activity_availability",
            activityId: "recover",
            status: "enabled"
          }
        ],
        objectives: [
          {
            type: "attribute_reached",
            attribute: "vitality",
            target: 10
          }
        ]
      }
    ]);
    questsSubject.complete();

    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "active"
    });
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "enabled"
    });
    expect(service.latestQuestMessage()).toBe("Quest received: reach 10.0 Vitality.");
    expect(
      questEvents.filter(
        (event) =>
          event.type === "quest-start-queued" || event.type === "quest-started"
      )
    ).toEqual([
      {
        type: "quest-start-queued",
        questId: "quest_recovery",
        message: "Queued quest start: Recovery."
      },
      {
        type: "quest-started",
        questId: "quest_recovery",
        message: "Quest received: reach 10.0 Vitality."
      }
    ]);
  });

  it("retries queued quest starts when authored quest data and an active player become available later", async () => {
    const questsSubject = new Subject<readonly Quest[]>();
    const { roster, service } = createFixture({
      questsLoad: () => questsSubject.asObservable()
    });
    const player = clonePlayer(samplePlayer);

    player.attributes.vitality = 5;
    player.story = {
      currentArcId: "prologue",
      currentChapter: 1
    };
    player.activityState = {
      availability: {},
      activeActivityId: null
    };

    roster.createCharacter(player);

    expect(service.startQuestById("quest_side_work")).toBe(true);
    expect(roster.activeCharacter()?.questLog?.quests["quest_side_work"]).toBeUndefined();

    const activeSlotId = roster.activeSlotId();
    if (!activeSlotId) {
      throw new Error("Expected an active slot after character creation.");
    }

    roster.deleteSlot(activeSlotId);

    questsSubject.next([
      {
        id: "quest_side_work",
        objectives: [
          {
            type: "attribute_reached",
            attribute: "vitality",
            target: 6
          }
        ]
      }
    ]);
    questsSubject.complete();

    expect(roster.activeCharacter()).toBeNull();

    const returningPlayer = clonePlayer(samplePlayer);
    returningPlayer.attributes.vitality = 5;
    returningPlayer.story = {
      currentArcId: "prologue",
      currentChapter: 1
    };
    returningPlayer.activityState = {
      availability: {},
      activeActivityId: null
    };

    roster.createCharacter(returningPlayer);
    await waitForTaskQueue();

    expect(roster.activeCharacter()?.questLog?.quests["quest_side_work"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "active"
    });
  });

  it("reconciles post-prologue saves that are missing the scripted recovery quest", async () => {
    const { roster, service } = createFixture();
    const questEvents: GameQuestEvent[] = [];
    const player = clonePlayer(samplePlayer);

    service.events$.subscribe((event) => {
      questEvents.push(event);
    });

    player.attributes.vitality = 7;
    player.story = {
      currentArcId: "prologue",
      currentChapter: 2
    };
    player.questLog = {
      quests: {}
    };
    player.activityState = {
      availability: {},
      activeActivityId: null
    };

    roster.createCharacter(player);
    await waitForTaskQueue();

    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "active"
    });
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "enabled"
    });
    expect(service.latestQuestMessage()).toBe("Quest received: reach 10.0 Vitality.");
    expect(questEvents.filter((event) => event.type === "quest-started")).toEqual([
      {
        type: "quest-started",
        questId: "quest_recovery",
        message: "Quest received: reach 10.0 Vitality."
      }
    ]);
  });

  it("reconciles imported post-prologue saves that are missing the scripted recovery quest", async () => {
    const { roster, service } = createFixture();
    const importedPlayer = buildPostPrologueRecoveryPlayer();
    const importedEvents: GameQuestEvent[] = [];
    const payload = buildRosterPayload(importedPlayer);

    localStorage.clear();
    service.events$.subscribe((event) => {
      importedEvents.push(event);
    });

    expect(roster.importRoster(payload)).toBe(1);
    await waitForTaskQueue();

    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "active"
    });
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "enabled"
    });
    expect(service.latestQuestMessage()).toBe("Quest received: reach 10.0 Vitality.");
    expect(importedEvents.filter((event) => event.type === "quest-started")).toEqual([
      {
        type: "quest-started",
        questId: "quest_recovery",
        message: "Quest received: reach 10.0 Vitality."
      }
    ]);
  });

  it("reconciles hydrated post-prologue saves that are missing the scripted recovery quest", async () => {
    const payload = buildRosterPayload(buildPostPrologueRecoveryPlayer());

    localStorage.setItem("grayvale:save-slots:v1", payload);

    const { roster, service } = createFixture();

    await waitForTaskQueue();

    expect(roster.activeCharacter()?.questLog?.quests["quest_recovery"]).toMatchObject({
      currentStep: "runtime_objectives",
      status: "active"
    });
    expect(roster.activeCharacter()?.activityState?.availability["recover"]).toEqual({
      status: "enabled"
    });
    expect(service.latestQuestMessage()).toBe("Quest received: reach 10.0 Vitality.");
  });

  it("applies item rewards from authored activities", () => {
    const { roster, service } = createFixture();
    const player = clonePlayer(samplePlayer);

    player.questLog = {
      quests: {}
    };
    player.activityState = {
      availability: {
        gather_medicine_herb_t1: {
          status: "enabled"
        }
      },
      activeActivityId: null
    };
    player.inventory.items = {};

    roster.createCharacter(player);

    expect(service.executeActivityById("gather_medicine_herb_t1")).toBe(true);
    expect(roster.activeCharacter()?.inventory.items["mat_medicine_herb_t1"]).toBe(1);
    expect(roster.activeCharacter()?.attributes["agility"]).toBeGreaterThan(samplePlayer.attributes["agility"]);
  });
});

function createFixture(): {
  roster: CharacterRosterService;
  service: GameQuestService;
}
function createFixture(options?: {
  questsLoad?: () => ReturnType<QuestsLoader["load"]>;
}): {
  roster: CharacterRosterService;
  service: GameQuestService;
} {
  const roster = new CharacterRosterService();
  const quests: readonly Quest[] = [
    {
      id: "quest_recovery",
      startRewards: [
        {
          type: "activity_availability",
          activityId: "recover",
          status: "enabled"
        }
      ],
      objectives: [
        {
          type: "attribute_reached",
          attribute: "vitality",
          target: 10
        }
      ],
      rewards: [
        {
          type: "activity_availability",
          activityId: "recover",
          status: "locked"
        },
        {
          type: "attribute_unlock",
          attributeId: "strength"
        }
      ]
    }
  ];
  const activities: readonly GameActivityDefinition[] = [
    {
      id: "recover",
      name: "Recover",
      description: "Steady your breathing and let the worst of the pain pass.",
      location: { locationId: "village-arkama", sublocationId: "chief-house" },
      tags: ["recovery", "rest"],
      governingAttributes: ["vitality"],
      difficulty: 5,
      rewards: [
        {
          type: "attribute",
          targetId: "vitality",
          value: {
            type: "flat",
            amount: 1
          },
          distribution: {
            type: "deterministic"
          }
        }
      ]
    },
    {
      id: "gather_medicine_herb_t1",
      name: "Gather Medicine Herb",
      description: "Work the lit edges of the brush for fresh medicine herbs.",
      location: { locationId: "forest_edge" },
      tags: ["forest", "gathering", "herb", "repeatable", "t1"],
      governingAttributes: ["agility", "vitality"],
      difficulty: 4,
      rewards: [
        {
          type: "item",
          targetId: "mat_medicine_herb_t1",
          value: {
            type: "flat",
            amount: 1
          },
          distribution: {
            type: "deterministic"
          }
        },
        {
          type: "attribute",
          targetId: "agility",
          value: {
            type: "flat",
            amount: 0.15
          },
          distribution: {
            type: "deterministic"
          }
        }
      ]
    }
  ];
  TestBed.configureTestingModule({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      {
        provide: QuestsLoader,
        useValue: { load: options?.questsLoad ?? (() => of(quests)) }
      },
      { provide: ActivitiesLoader, useValue: { load: () => of(activities) } },
      QuestTracker,
      GameQuestService
    ]
  });

  return {
    roster,
    service: TestBed.inject(GameQuestService)
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildPostPrologueRecoveryPlayer() {
  const player = clonePlayer(samplePlayer);

  player.attributes.vitality = 7;
  player.story = {
    currentArcId: "prologue",
    currentChapter: 2
  };
  player.questLog = {
    quests: {}
  };
  player.activityState = {
    availability: {},
    activeActivityId: null
  };

  return player;
}

function buildRosterPayload(player = buildPostPrologueRecoveryPlayer()): string {
  const roster = new CharacterRosterService();

  roster.createCharacter(player);
  return roster.exportAll();
}

function waitForTaskQueue(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
