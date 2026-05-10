import { Injector, runInInjectionContext, signal } from "@angular/core";
import { samplePlayer, type Player } from "@rinner/grayvale-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { of } from "rxjs";

import { CharacterCreatorOptionsLoader } from "../../data/loaders/character-creator-options.loader";
import { DialogueDefinitionsLoader } from "../../data/loaders/dialogue-definitions.loader";
import { DialogueProjectLoader } from "../../data/loaders/dialogue-project.loader";
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

    service.startDialogueById("prologue");

    expect(service.session()?.mode).toBe("valeflow");
    expect(service.session()?.currentEntry?.kind).toBe("say");
    expect(service.session()?.currentEntry?.actor?.name).toBe("Narrator");
    expect(service.session()?.currentEntry?.text).toContain("Pain drags you back");
  });

  it("reports an error when a dialogue id is not defined", () => {
    const { service } = createFixture();

    service.startDialogueById("missing-dialogue");

    expect(service.session()).toBeNull();
    expect(service.error()).toBe('Unknown dialogue id "missing-dialogue".');
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

  it("opens the chief's village follow-up using top-level location metadata", () => {
    const { service, worldState } = createFixture();

    worldState.currentSublocationMetadata.set(null);

    service.startChiefBridgitteHandoff();

    expect(service.session()?.title).toBe("A New Lead");
    expect(service.session()?.eyebrow).toBe("Arkama Village");
    expect(service.session()?.subtitle).toBe(
      "The unofficial name the locals use for their nameless settlement."
    );
    expect(service.session()?.sceneImagePath).toBe(
      "assets/images/location-backgrounds/village.png"
    );
    expect(service.session()?.currentEntry?.actor?.name).toBe("Village Chief");
    expect(service.session()?.currentEntry?.text).toContain("hoping you would come by");
  });

  it("opens chief-labour at the chief-labour START line", () => {
    const { service } = createFixture();

    service.startChiefLabour();

    expect(service.session()?.title).toBe("The Chief's Request");
    expect(service.session()?.currentEntry?.actor?.name).toBe("Village Chief");
    expect(service.session()?.currentEntry?.text).toContain("You're on your feet. Good.");
  });

  it("opens Bridgitte's house dialogue and presents her intro", () => {
    const { service, worldState } = createFixture();

    worldState.currentSublocationMetadata.set({
      id: "bridgitte-house",
      label: "Bridgitte's House",
      subtitle: "A quiet house where an old adventurer keeps her past within arm's reach.",
      sceneImagePath: "assets/images/location-backgrounds/bridgette-house.png",
      availableNpcIds: ["bridgitte"],
      isReturnable: true,
      entryActionLabel: "Visit Bridgitte's house",
      exitActionLabel: "Leave Bridgitte's house"
    });

    service.startBridgitteHouse();

    expect(service.session()?.title).toBe("Bridgitte");
    expect(service.session()?.eyebrow).toBe("Bridgitte's House");
    expect(service.session()?.sceneImagePath).toBe(
      "assets/images/location-backgrounds/bridgette-house.png"
    );
    expect(service.session()?.currentEntry?.actor?.name).toBe("Narrator");
    expect(service.session()?.currentEntry?.text).toContain("smells faintly of woodsmoke");
  });

  it("processes Bridgitte's tutorial hooks through the dialogue bridge", () => {
    const { service, roster, gameQuests, worldState } = createFixture();
    const receivedEvents: GameDialogEvent[] = [];

    service.events$.subscribe((event) => {
      receivedEvents.push(event);
    });

    worldState.currentSublocationMetadata.set({
      id: "bridgitte-house",
      label: "Bridgitte's House",
      subtitle: "A quiet house where an old adventurer keeps her past within arm's reach.",
      sceneImagePath: "assets/images/location-backgrounds/bridgette-house.png",
      availableNpcIds: ["bridgitte"],
      isReturnable: true,
      entryActionLabel: "Visit Bridgitte's house",
      exitActionLabel: "Leave Bridgitte's house"
    });

    service.startBridgitteHouse();
    advanceUntilChoice(service);
    service.choose(0);
    advanceUntilQuestStart(service, gameQuests.startQuestById);

    expect(gameQuests.startQuestById).toHaveBeenCalledWith("cull_arkama_coyote");
    expect(roster.activeCharacter()?.inventory.items["weapon_dagger_rustleaf"]).toBe(1);
    expect(roster.activeSlot()?.statUnlocks.skills["short_blade"]).toBe(true);
    expect(
      receivedEvents.some(
        (event) => event.type === "log-event" && event.text === "Classes are still WIP"
      )
    ).toBe(true);
  });

  it("opens Bridgitte repeatables directly from the repeatables entry file", () => {
    const { service, worldState } = createFixture();

    worldState.currentSublocationMetadata.set({
      id: "bridgitte-house",
      label: "Bridgitte's House",
      subtitle: "A quiet house where an old adventurer keeps her past within arm's reach.",
      sceneImagePath: "assets/images/location-backgrounds/bridgette-house.png",
      availableNpcIds: ["bridgitte"],
      isReturnable: true,
      entryActionLabel: "Visit Bridgitte's house",
      exitActionLabel: "Leave Bridgitte's house"
    });

    service.startDialogueById("bridgitte-repeatables");

    expect(service.session()?.title).toBe("Bridgitte");
    expect(service.session()?.currentEntry?.actor?.name).toBe("Narrator");
    expect(service.session()?.currentEntry?.text).toContain("checking the edge on a skinning knife");
  });

  it("uses the report-back dialogue to resolve the coyote quest and seed the next quests", () => {
    const { service, gameQuests, worldState } = createFixture();

    worldState.currentSublocationMetadata.set({
      id: "bridgitte-house",
      label: "Bridgitte's House",
      subtitle: "A quiet house where an old adventurer keeps her past within arm's reach.",
      sceneImagePath: "assets/images/location-backgrounds/bridgette-house.png",
      availableNpcIds: ["bridgitte"],
      isReturnable: true,
      entryActionLabel: "Visit Bridgitte's house",
      exitActionLabel: "Leave Bridgitte's house"
    });

    service.startDialogueById("bridgitte-report-back");
    advanceUntilSessionEnds(service, 80);

    expect(gameQuests.resolveQuestStep).toHaveBeenCalledWith(
      "cull_arkama_coyote",
      "report_back_to_bridgitte"
    );
    expect(gameQuests.startQuestById).toHaveBeenCalledWith("learn_five_finger_fillet");
    expect(gameQuests.startQuestById).toHaveBeenCalledWith("lydia_smithing_intro");
    expect(gameQuests.startQuestById).toHaveBeenCalledWith("shopkeep_forest_supplies");
  });

  it("replaces an open activity session when a story dialogue starts", () => {
    const { service } = createFixture();

    service.startActivity("recover", "Recover");
    expect(service.session()?.mode).toBe("activity");

    service.startChiefLabour();

    expect(service.session()?.mode).toBe("valeflow");
    expect(service.session()?.currentEntry?.actor?.name).toBe("Village Chief");
    expect(service.session()?.currentEntry?.text).toContain("You're on your feet");
  });

  it("surfaces dialogue compilation failures as error state instead of throwing", () => {
    const { service } = createFixture({
      dialogueProjectFiles: [
        {
          filename: "prologue/valeflow-prologue.fsc",
          source: { broken: true } as unknown as string
        }
      ]
    });

    service.startPrologue();

    expect(service.session()).toBeNull();
    expect(service.error()).toContain("split");
  });
});

function createFixture(): {
  roster: CharacterRosterService;
  gameQuests: {
    startQuestById: jest.Mock;
    resolveQuestStep: jest.Mock;
  };
  worldState: {
    currentLocationMetadata: ReturnType<typeof signal>;
    currentSublocationMetadata: ReturnType<typeof signal>;
  };
  service: GameDialogService;
}

function createFixture(options?: {
  dialogueProjectFiles?: readonly { filename: string; source: string }[];
}): {
  roster: CharacterRosterService;
  gameQuests: {
    startQuestById: jest.Mock;
    resolveQuestStep: jest.Mock;
  };
  worldState: {
    currentLocationMetadata: ReturnType<typeof signal>;
    currentSublocationMetadata: ReturnType<typeof signal>;
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

  const dialogueProjectLoader = {
    load: jest.fn(() =>
      of([
        ...(options?.dialogueProjectFiles ?? [
          loadDialogueFile("assets/dialogue/globals.fsc"),
          loadDialogueFile("assets/dialogue/prologue/valeflow-prologue.fsc"),
          loadDialogueFile("assets/dialogue/prologue/chief-labour.fsc"),
          loadDialogueFile("assets/dialogue/arkama/chief-bridgitte-handoff.fsc"),
          loadDialogueFile("assets/dialogue/arkama/bridgitte-house.fsc"),
          loadDialogueFile("assets/dialogue/arkama/bridgitte-report-back.fsc"),
          loadDialogueFile("assets/dialogue/arkama/bridgitte-repetables.fsc")
        ])
      ])
    )
  };
  const dialogueDefinitionsLoader = {
    load: jest.fn(() =>
      of([
        {
          id: "prologue",
          entryFile: "prologue/valeflow-prologue.fsc",
          title: "Wake Up",
          eyebrowFallback: "Prologue",
          subtitleFallback: "A hard-won return to consciousness."
        },
        {
          id: "chief-labour",
          entryFile: "prologue/chief-labour.fsc",
          title: "The Chief's Request",
          eyebrowFallback: "Chief House",
          subtitleFallback: "He has work for you."
        },
        {
          id: "chief-bridgitte-handoff",
          entryFile: "arkama/chief-bridgitte-handoff.fsc",
          title: "A New Lead",
          eyebrowFallback: "Arkama Village",
          subtitleFallback: "The chief has someone she wants you to meet."
        },
        {
          id: "bridgitte-house",
          entryFile: "arkama/bridgitte-house.fsc",
          title: "Bridgitte",
          eyebrowFallback: "Bridgitte's House",
          subtitleFallback: "A retired adventurer finally opens her door to you."
        },
        {
          id: "bridgitte-report-back",
          entryFile: "arkama/bridgitte-report-back.fsc",
          title: "Bridgitte",
          eyebrowFallback: "Bridgitte's House",
          subtitleFallback: "Your first contract is done, and Bridgitte has more direction for you."
        },
        {
          id: "bridgitte-repeatables",
          entryFile: "arkama/bridgitte-repetables.fsc",
          title: "Bridgitte",
          eyebrowFallback: "Bridgitte's House",
          subtitleFallback: "A retired adventurer answers what she is willing to share."
        }
      ])
    )
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
    currentLocationMetadata: signal({
      id: "village-arkama",
      label: "Arkama Village",
      subtitle: "The unofficial name the locals use for their nameless settlement.",
      sceneImagePath: "assets/images/location-backgrounds/village.png",
      availableNpcIds: ["village-chief"],
      sublocations: []
    }),
    currentSublocationMetadata: signal<{
      id: string;
      label: string;
      subtitle: string;
      sceneImagePath: string;
      availableNpcIds: string[];
      isReturnable: boolean;
      entryActionLabel: string;
      exitActionLabel: string;
    } | null>({
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
    startQuestById: jest.fn(() => true),
    resolveQuestStep: jest.fn(() => true)
  };
  const debugLog = {
    logMessage: jest.fn(),
    logRaw: jest.fn(),
    log$: of([]),
    entries$: of([])
  };
  const injector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: CharacterCreatorOptionsLoader, useValue: creatorOptionsLoader },
      { provide: DialogueDefinitionsLoader, useValue: dialogueDefinitionsLoader },
      { provide: DialogueProjectLoader, useValue: dialogueProjectLoader },
      { provide: DialogueActorsLoader, useValue: dialogueActorsLoader },
      { provide: DebugLogService, useValue: debugLog },
      { provide: GameQuestService, useValue: gameQuests },
      { provide: WorldStateService, useValue: worldState }
    ]
  });

  return {
    roster,
    gameQuests,
    worldState,
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

function advanceUntilChoice(service: GameDialogService, maxSteps = 120): void {
  for (let step = 0; step < maxSteps; step += 1) {
    if (service.session()?.isAwaitingChoice) {
      return;
    }

    service.advance();
  }

  throw new Error("Expected dialogue choices to appear.");
}

function advanceUntilQuestStart(service: GameDialogService, startQuestById: jest.Mock, maxSteps = 120): void {
  for (let step = 0; step < maxSteps; step += 1) {
    if (startQuestById.mock.calls.length > 0) {
      return;
    }

    if (service.session()?.isAwaitingChoice) {
      throw new Error("Encountered an unexpected choice before the tutorial hooks fired.");
    }

    service.advance();
  }

  throw new Error("Expected the dialogue to trigger a quest start.");
}

function loadDialogueFile(assetPath: string): { filename: string; source: string } {
  const prefix = "assets/dialogue/";

  return {
    filename: assetPath.startsWith(prefix) ? assetPath.slice(prefix.length) : assetPath,
    source: readFileSync(resolve(__dirname, "../../../", assetPath), "utf8")
  };
}
