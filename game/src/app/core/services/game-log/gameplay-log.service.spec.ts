import { Injector, runInInjectionContext } from "@angular/core";
import { samplePlayer, type Delta } from "@rinner/grayvale-core";
import { Subject } from "rxjs";

import { CharacterRosterService } from "../character-roster.service";
import { GameDialogService } from "../game-dialog.service";
import { GameQuestService } from "../game-quest.service";
import { DebugLogService } from "./debug-log.service";
import { GameplayLogService } from "./gameplay-log.service";
import { mapDeltaToGameplayLogEntry } from "./log-mapper";
import type { GameDialogEvent } from "../../shared/components/game-dialog/game-dialog.types";
import type { GameQuestEvent } from "../game-quest.types";

describe("GameplayLogService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("maps attribute updates into player-facing system entries", () => {
    const { gameplayLog } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    gameplayLog.processDelta({
      type: "add",
      target: "player",
      path: ["attributes", "vitality"],
      value: 2
    });

    expect(latestLog).toEqual([{ type: "system", text: "Vitality +2" }]);
  });

  it("batches consecutive currency gains into one loot entry", () => {
    const { gameplayLog } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    gameplayLog.processDelta(createCurrencyDelta("mark", 2));
    gameplayLog.processDelta(createCurrencyDelta("mark", 3));

    expect(latestLog).toEqual([{ type: "loot", text: "Received Mark x5" }]);
  });

  it("filters internal and redundant delta traffic", () => {
    const { gameplayLog } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    gameplayLog.processDelta({
      type: "add",
      target: "player",
      path: ["interactionState", "totalButtonPresses"],
      value: 0
    });
    gameplayLog.processDelta({
      type: "add",
      target: "player",
      path: ["inventory", "items", "ore_chunk"],
      value: 0
    });
    gameplayLog.processDelta({
      type: "set",
      target: "player",
      path: ["questLog", "quests", "quest_recovery"],
      value: {
        currentStep: "runtime_objectives",
        status: "active"
      }
    });
    gameplayLog.processDelta({
      type: "set",
      target: "player",
      path: ["questLog", "quests", "quest_recovery"],
      value: {
        currentStep: "runtime_objectives",
        status: "active"
      }
    });

    expect(latestLog).toEqual([{ type: "quest", text: "Quest started: Recovery" }]);
  });

  it("maps quest, item, and combat deltas through the roster pipeline", () => {
    const { gameplayLog, roster } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    roster.createCharacter(clone(samplePlayer));
    roster.applyActiveCharacterDeltas([
      createQuestDelta("quest_recovery", "active"),
      createItemDelta("monster_hide", 2),
      createKillDelta("goblin", 1)
    ]);

    expect(latestLog).toEqual([
      { type: "quest", text: "Quest started: Recovery" },
      { type: "loot", text: "Received Monster Hide x2" },
      { type: "combat", text: "Defeated Goblin x1" }
    ]);
  });

  it("humanizes skill, equipment, and npc deltas that were previously unmapped", () => {
    const { gameplayLog } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    gameplayLog.processDelta({
      type: "add",
      target: "player",
      path: ["skills", "blacksmithing"],
      value: 1
    });
    gameplayLog.processDelta({
      type: "set",
      target: "player",
      path: ["equippedItems", "mainHand"],
      value: "steel_sword"
    });
    gameplayLog.processDelta({
      type: "add",
      target: "npc",
      targetId: "village_chief",
      path: ["trust"],
      value: 5
    });

    expect(latestLog).toEqual([
      { type: "system", text: "Blacksmithing +1" },
      { type: "loot", text: "Equipped Steel Sword in Main Hand" },
      { type: "system", text: "Village Chief Trust +5" }
    ]);
  });

  it("records movement from the centralized world update stream", () => {
    const { gameplayLog, roster } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    roster.createCharacter(clone(samplePlayer));
    roster.updateActiveWorld({
      currentLocation: "village-arkama",
      sublocations: []
    });
    roster.updateActiveWorld({
      currentLocation: "camp",
      sublocations: []
    });

    expect(latestLog).toEqual([
      { type: "system", text: "Left Chief House" },
      { type: "system", text: "Traveled from Village Arkama to Camp" }
    ]);
  });

  it("keeps raw deltas in the debug log service", () => {
    const { debugLog } = createFixture();
    let latestLog: Delta[] = [];

    debugLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    const delta = createItemDelta("ore_chunk", 1);
    debugLog.logRaw(delta);

    expect(latestLog).toEqual([delta]);
  });

  it("stores runtime trace messages in the debug log service", () => {
    const { debugLog } = createFixture();
    let latestEntries: Array<{ scope: string; message: string; details?: string }> = [];

    debugLog.entries$.subscribe((entries) => {
      latestEntries = entries;
    });

    debugLog.logMessage("shell", "Gameplay action selected.", {
      actionId: "story:wake-up"
    });

    expect(latestEntries.at(-1)).toMatchObject({
      scope: "shell",
      message: "Gameplay action selected.",
      details: expect.stringContaining("story:wake-up")
    });
  });

  it("exposes a concrete currency mapper for documented ids", () => {
    expect(mapDeltaToGameplayLogEntry(createCurrencyDelta("currency_crown", 4))?.entry).toEqual({
      type: "loot",
      text: "Received Crown x4"
    });
  });

  it("maps equipment changes into human loot entries", () => {
    expect(
      mapDeltaToGameplayLogEntry({
        type: "set",
        target: "player",
        path: ["equippedItems", "mainHand"],
        value: "steel_sword"
      })?.entry
    ).toEqual({
      type: "loot",
      text: "Equipped Steel Sword in Main Hand"
    });
  });

  it("records dialogue lines, choice menus, and selected dialogue options", () => {
    const { gameplayLog } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    gameplayLog.processDialogEvent({
      type: "line-shown",
      entry: {
        id: "line-1",
        kind: "say",
        actor: {
          id: "village-chief",
          name: "Village Chief"
        },
        text: "Easy now."
      }
    });
    gameplayLog.processDialogEvent({
      type: "choices-presented",
      choices: [
        {
          index: 0,
          label: "What happened to me?",
          seen: false
        },
        {
          index: 1,
          label: "Get up",
          seen: true
        }
      ]
    });
    gameplayLog.processDialogEvent({
      type: "choice-selected",
      choice: {
        index: 1,
        label: "Get up",
        seen: true
      }
    });

    expect(latestLog).toEqual([
      { type: "dialogue", text: "Village Chief: Easy now." },
      {
        type: "choice",
        options: [
          {
            index: 0,
            label: "What happened to me?",
            seen: false
          },
          {
            index: 1,
            label: "Get up",
            seen: true
          }
        ]
      },
      { type: "dialogue", text: "Chose: Get up" }
    ]);
  });

  it("records quest lifecycle events without duplicating tagged quest deltas", () => {
    const { gameplayLog } = createFixture();
    let latestLog: unknown[] = [];

    gameplayLog.log$.subscribe((entries) => {
      latestLog = entries;
    });

    gameplayLog.processQuestEvent({
      type: "quest-start-queued",
      questId: "quest_recovery",
      message: "Queued quest start: Recovery."
    });
    gameplayLog.processQuestEvent({
      type: "quest-started",
      questId: "quest_recovery",
      message: "Quest received: reach 10.0 Vitality."
    });
    gameplayLog.processDelta({
      type: "set",
      target: "player",
      path: ["questLog", "quests", "quest_recovery"],
      value: {
        currentStep: "runtime_objectives",
        status: "active"
      },
      meta: {
        gameplayLogHandledBy: "quest-event"
      }
    });
    gameplayLog.processQuestEvent({
      type: "quest-completed",
      questId: "quest_recovery",
      message: "Quest complete: reach 10.0 Vitality. Recover is now hidden."
    });

    expect(latestLog).toEqual([
      { type: "quest", text: "Quest received: reach 10.0 Vitality." },
      { type: "quest", text: "Quest complete: reach 10.0 Vitality. Recover is now hidden." }
    ]);
  });
});

function createFixture(): {
  roster: CharacterRosterService;
  gameplayLog: GameplayLogService;
  debugLog: DebugLogService;
} {
  const roster = new CharacterRosterService();
  const dialogEvents = new Subject<GameDialogEvent>();
  const questEvents = new Subject<GameQuestEvent>();
  const injector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      {
        provide: GameDialogService,
        useValue: {
          events$: dialogEvents.asObservable()
        }
      },
      {
        provide: GameQuestService,
        useValue: {
          events$: questEvents.asObservable()
        }
      }
    ]
  });

  return runInInjectionContext(injector, () => ({
    roster,
    gameplayLog: new GameplayLogService(),
    debugLog: new DebugLogService()
  }));
}

function createCurrencyDelta(currencyId: string, amount: number): Delta {
  return {
    type: "add",
    target: "player",
    path: ["inventory", "items", currencyId],
    value: amount
  };
}

function createItemDelta(itemId: string, amount: number): Delta {
  return {
    type: "add",
    target: "player",
    path: ["inventory", "items", itemId],
    value: amount
  };
}

function createQuestDelta(questId: string, status: "active" | "completed"): Delta {
  return {
    type: "set",
    target: "player",
    path: ["questLog", "quests", questId],
    value: {
      currentStep: "runtime_objectives",
      status
    }
  };
}

function createKillDelta(target: string, count: number): Delta {
  return {
    type: "add",
    target: "player",
    path: ["interactionState", "totalButtonPresses"],
    value: 0,
    meta: {
      questSignal: {
        type: "kill",
        target,
        count
      }
    }
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
