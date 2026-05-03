import { Injector, runInInjectionContext, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { samplePlayer, type Player } from "@rinner/grayvale-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { of } from "rxjs";

import { CharacterCreatorOptionsLoader } from "../../data/loaders/character-creator-options.loader";
import { DialogueActorsLoader } from "../../data/loaders/dialogue-actors.loader";
import { CharacterRosterService } from "./character-roster.service";
import { GameDialogService } from "./game-dialog.service";
import { DebugLogService } from "./game-log/debug-log.service";
import { GameQuestService } from "./game-quest.service";
import { WorldStateService } from "./world-state.service";
import type { GameDialogEvent } from "../../shared/components/game-dialog/game-dialog.types";

describe("GameDialogService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("opens the prologue and shows the first narration beat", () => {
    const { service } = createFixture();

    service.startPrologue();

    expect(service.session()?.mode).toBe("valeflow");
    expect(service.session()?.currentEntry?.kind).toBe("say");
    expect(service.session()?.currentEntry?.actor?.name).toBe("Narrator");
    expect(service.session()?.currentEntry?.text).toContain("Pain drags you back");
  });

  it("interpolates player name and race, loops flavor questions, and queues no deltas before the ending branch", () => {
    const { service, roster, gameQuests } = createFixture();

    service.startPrologue();
    service.advance();

    expect(service.session()?.choices).toEqual([
      {
        index: 0,
        label: "Open your eyes",
        seen: false
      }
    ]);

    service.choose(0);
    expect(service.session()?.currentEntry?.kind).toBe("say");
    expect(service.session()?.currentEntry?.actor?.name).toBe("Village Chief");
    expect(service.session()?.currentEntry?.text).toContain("Human");

    service.advance();
    service.advance();

    expect(service.session()?.choices.map((choice) => choice.label)).toEqual([
      "What happened to me?",
      "Where am I?",
      "Why help me?",
      "Get up"
    ]);

    service.choose(0);
    service.advance();
    expect(service.session()?.currentEntry?.text).toContain("Bandits, beasts, river-stone");

    service.advance();
    service.advance();

    expect(roster.activeCharacter()?.story?.currentChapter).toBe(1);
    expect(service.queuedDeltas()).toEqual([]);
    expect(service.session()?.choices.at(-1)?.label).toBe("Get up");
    expect(gameQuests.startQuestById).not.toHaveBeenCalled();
  });

  it("dispatches scripted prologue deltas immediately when the terminal branch starts", () => {
    const { service, roster, gameQuests } = createFixture();

    service.startPrologue();
    service.advance();
    service.choose(0);
    service.advance();
    service.advance();
    service.choose(3);

    expect(service.session()?.currentEntry?.text).toContain("Easy now");

    for (
      let step = 0;
      step < 20 && service.session() !== null && roster.activeCharacter()?.story?.currentChapter !== 2;
      step += 1
    ) {
      if (service.session()?.isAwaitingChoice) {
        throw new Error("Unexpected choice while waiting for scripted deltas.");
      }

      service.advance();
    }

    expect(roster.activeCharacter()?.story?.currentChapter).toBe(2);
    expect(gameQuests.startQuestById).toHaveBeenCalledWith("quest_recovery");

    advanceUntilSessionEnds(service);

    expect(service.session()).toBeNull();
    expect(service.queuedDeltas()).toEqual([
      {
        type: "set",
        target: "player",
        path: ["story", "currentChapter"],
        value: 2
      }
    ]);
    expect(gameQuests.startQuestById).toHaveBeenCalledWith("quest_recovery");
    expect(roster.activeCharacter()?.story?.currentChapter).toBe(2);
  });

  it("emits observable dialogue events for lines, choices, and selected options", () => {
    const { service } = createFixture();
    const receivedEvents: GameDialogEvent[] = [];

    service.events$.subscribe((event) => {
      receivedEvents.push(event);
    });

    service.startPrologue();
    service.advance();

    expect(receivedEvents[0]).toEqual({
      type: "session-started",
      mode: "valeflow",
      title: "Wake Up",
      eyebrow: "Chief House",
      subtitle: "A quiet recovery room under the village chief's roof."
    });
    expect(receivedEvents[1]).toMatchObject({
      type: "line-shown",
      entry: {
        kind: "say",
        text: expect.stringContaining("Pain drags you back")
      }
    });
    expect(receivedEvents[2]).toEqual({
      type: "choices-presented",
      choices: [
        {
          index: 0,
          label: "Open your eyes",
          seen: false
        }
      ]
    });

    service.choose(0);

    expect(receivedEvents[3]).toEqual({
      type: "choice-selected",
      choice: {
        index: 0,
        label: "Open your eyes",
        seen: false
      }
    });
    expect(receivedEvents[4]).toMatchObject({
      type: "line-shown",
      entry: {
        kind: "say",
        actor: {
          name: "Village Chief"
        }
      }
    });
  });
});

function createFixture(): {
  roster: CharacterRosterService;
  gameQuests: {
    startQuestById: jest.Mock;
  };
  service: GameDialogService;
} {
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

  const http = {
    get: jest.fn((url: string, options?: { responseType?: string }) => {
      if (url === "assets/dialogue/prologue/valeflow-prologue.fsc") {
        expect(options?.responseType).toBe("text");
        return of(
          readFileSync(
            resolve(__dirname, "../../../assets/dialogue/prologue/valeflow-prologue.fsc"),
            "utf8"
          )
        );
      }

      throw new Error(`Unexpected HttpClient.get call for ${url}.`);
    })
  };
  const dialogueActorsLoader = {
    load: jest.fn(() =>
      of(
        JSON.parse(
          readFileSync(resolve(__dirname, "../../../assets/data/dialogue-actors.json"), "utf8")
        ) as ReturnType<DialogueActorsLoader["load"]> extends infer _T ? unknown : never
      )
    )
  };
  const creatorOptionsLoader = {
    load: jest.fn(() =>
      of(
        JSON.parse(
          readFileSync(resolve(__dirname, "../../../assets/data/character-creator.json"), "utf8")
        ) as ReturnType<CharacterCreatorOptionsLoader["load"]> extends infer _T ? unknown : never
      )
    )
  };
  const worldState = {
    currentSublocationMetadata: signal({
      id: "chief-house",
      label: "Chief House",
      subtitle: "A quiet recovery room under the village chief's roof.",
      sceneImagePath: "assets/images/location-backgrounds/prologue.png",
      availableNpcIds: ["village-chief"],
      isReturnable: true,
      entryActionLabel: "Return to chief house",
      exitActionLabel: "Leave chief house"
    })
  };
  const gameQuests = {
    startQuestById: jest.fn(() => true)
  };
  const debugLog = {
    logMessage: jest.fn(),
    logRaw: jest.fn(),
    log$: of([]),
    entries$: of([])
  };
  const injector = Injector.create({
    providers: [
      { provide: HttpClient, useValue: http },
      { provide: CharacterRosterService, useValue: roster },
      { provide: CharacterCreatorOptionsLoader, useValue: creatorOptionsLoader },
      { provide: DialogueActorsLoader, useValue: dialogueActorsLoader },
      { provide: DebugLogService, useValue: debugLog },
      { provide: GameQuestService, useValue: gameQuests },
      { provide: WorldStateService, useValue: worldState }
    ]
  });

  return {
    roster,
    gameQuests,
    service: runInInjectionContext(injector, () => new GameDialogService())
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function advanceUntilSessionEnds(service: GameDialogService, maxSteps = 20): void {
  for (let step = 0; step < maxSteps && service.session() !== null; step += 1) {
    if (service.session()?.isAwaitingChoice) {
      throw new Error("advanceUntilSessionEnds encountered an unexpected choice.");
    }

    service.advance();
  }
}
