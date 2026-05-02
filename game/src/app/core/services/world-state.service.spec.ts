import { Injector, runInInjectionContext } from "@angular/core";
import { samplePlayer } from "@rinner/grayvale-core";
import type { WorldGraph } from "@rinner/grayvale-worldgraph";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { of } from "rxjs";

import type { WorldGuardCatalog } from "../../data/loaders/world-guards.loader";
import { WorldGuardsLoader } from "../../data/loaders/world-guards.loader";
import type { WorldLocationsCatalog } from "../../data/loaders/world-locations.loader";
import { WorldGraphLoader } from "../../data/loaders/world-graph.loader";
import { WorldLocationsLoader } from "../../data/loaders/world-locations.loader";
import { CharacterRosterService } from "./character-roster.service";
import { GameActionService } from "./game-action.service";
import { WorldStateService } from "./world-state.service";

describe("WorldStateService", () => {
  let roster: CharacterRosterService;
  let service: WorldStateService;

  beforeEach(() => {
    localStorage.clear();
    ({ roster, service } = createFixture());
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows only the local exit action while the player is in chief-house", () => {
    expect(service.isReady()).toBe(true);
    expect(service.currentLocationLabel()).toBe("Arkama Village");
    expect(service.currentSublocationLabel()).toBe("Chief House");
    expect(service.actionGroups()).toEqual([
      {
        kind: "movement",
        label: "MOVEMENT",
        themeKey: "movement",
        choices: [
          {
            id: "leave-chief-house",
            label: "Leave chief house",
            kind: "sublocation-exit",
            payload: {
              sublocationId: "chief-house"
            }
          }
        ]
      }
    ]);
  });

  it("applies button deltas before leaving chief-house", () => {
    const executed = service.executeAction("leave-chief-house");
    const activePlayer = roster.activeCharacter();

    expect(executed).toBe(true);
    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: []
    });
    expect(activePlayer?.interactionState?.totalButtonPresses).toBe(1);
    expect(activePlayer?.interactionState?.lastButtonPress).toEqual({
      actionId: "leave-chief-house",
      actionKind: "sublocation-exit",
      occurredAt: expect.any(String),
      locationId: "village-arkama",
      sublocationId: "chief-house",
      payload: {
        sublocationId: "chief-house"
      }
    });
  });

  it("supports entering and leaving the tavern through the shared action pipeline", () => {
    service.executeAction("leave-chief-house");

    expect(extractActionIds(service)).toEqual([
      "enter-chief-house",
      "enter-tavern",
      "travel-village-arkama-to-camp"
    ]);

    service.executeAction("enter-tavern");

    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: ["tavern"]
    });
    expect(service.currentSublocationLabel()).toBe("Tavern");
    expect(extractActionIds(service)).toEqual(["leave-tavern"]);

    service.executeAction("leave-tavern");

    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: []
    });
    expect(extractActionIds(service)).toEqual([
      "enter-chief-house",
      "enter-tavern",
      "travel-village-arkama-to-camp"
    ]);
  });

  it("travels to camp and back while recording the interaction history", () => {
    service.executeAction("leave-chief-house");
    service.executeAction("travel-village-arkama-to-camp");

    expect(roster.activeWorld()).toEqual({
      currentLocation: "camp",
      sublocations: []
    });
    expect(service.currentLocationLabel()).toBe("Camp");
    expect(service.currentSublocationLabel()).toBeNull();
    expect(extractActionIds(service)).toEqual(["travel-camp-to-village-arkama"]);

    service.executeAction("travel-camp-to-village-arkama");

    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: []
    });
    expect(roster.activeCharacter()?.interactionState?.totalButtonPresses).toBe(3);
    expect(roster.activeCharacter()?.interactionState?.recentButtonPresses).toHaveLength(3);
    expect(roster.activeCharacter()?.interactionState?.lastButtonPress).toEqual({
      actionId: "travel-camp-to-village-arkama",
      actionKind: "world-travel",
      occurredAt: expect.any(String),
      locationId: "camp",
      payload: {
        fromLocationId: "camp",
        targetLocationId: "village-arkama"
      }
    });
  });

  it("shows disabled travel actions with authored guard reasons when a route is gated", () => {
    const guardedPlayer = clonePlayer(samplePlayer);
    delete guardedPlayer.interactionState;
    guardedPlayer.progression.level = 1;
    const guardedGraph = loadWorldGraph();

    guardedGraph.edges = guardedGraph.edges.map((edge) =>
      edge.from === "village-arkama" && edge.to === "camp"
        ? {
            ...edge,
            guards: [
              {
                type: "player_level_at_least",
                params: {
                  minimumLevel: 2
                }
              }
            ]
          }
        : edge
    );

    ({ roster, service } = createFixture({
      player: guardedPlayer,
      graph: guardedGraph
    }));

    service.executeAction("leave-chief-house");

    expect(service.actionGroups()).toEqual([
      {
        kind: "movement",
        label: "MOVEMENT",
        themeKey: "movement",
        choices: [
          {
            id: "enter-chief-house",
            label: "Return to chief house",
            kind: "sublocation-enter",
            payload: {
              sublocationId: "chief-house"
            }
          },
          {
            id: "enter-tavern",
            label: "Enter tavern",
            kind: "sublocation-enter",
            payload: {
              sublocationId: "tavern"
            }
          }
        ]
      },
      {
        kind: "travel",
        label: "TRAVEL",
        themeKey: "travel",
        choices: [
          {
            id: "travel-village-arkama-to-camp",
            label: "Travel to Camp",
            kind: "world-travel",
            disabled: true,
            disabledReason: "Reach level 2 before traveling there.",
            payload: {
              fromLocationId: "village-arkama",
              targetLocationId: "camp"
            }
          }
        ]
      }
    ]);
    expect(service.executeAction("travel-village-arkama-to-camp")).toBe(false);
    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: []
    });
    expect(roster.activeCharacter()?.interactionState?.totalButtonPresses).toBe(1);
  });
});

function extractActionIds(service: WorldStateService): string[] {
  return service
    .actionGroups()
    .flatMap((group) => group.choices.map((choice) => choice.id));
}

function loadWorldGraph(): WorldGraph {
  return JSON.parse(
    readFileSync(
      resolve(__dirname, "../../../assets/data/world-graph.json"),
      "utf8"
    )
  ) as WorldGraph;
}

function loadWorldLocationsCatalog(): WorldLocationsCatalog {
  const rawCatalog = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../../assets/data/world-locations.json"),
      "utf8"
    )
  ) as {
    defaultState: { currentLocation: string; sublocations: string[] };
    locations: Array<{
      id: string;
      label: string;
      subtitle: string;
      sceneImagePath?: string;
      availableNpcIds: string[];
      sublocations?: Array<{
        id: string;
        label: string;
        subtitle: string;
        sceneImagePath?: string;
        availableNpcIds: string[];
        isReturnable: boolean;
        entryActionLabel?: string;
        exitActionLabel?: string;
      }>;
    }>;
  };

  return {
    defaultState: {
      currentLocation: rawCatalog.defaultState.currentLocation,
      sublocations: [...rawCatalog.defaultState.sublocations]
    },
    locations: rawCatalog.locations.map((location) => ({
      id: location.id,
      label: location.label,
      subtitle: location.subtitle,
      sceneImagePath: location.sceneImagePath,
      availableNpcIds: [...location.availableNpcIds],
      sublocations: (location.sublocations ?? []).map((sublocation) => ({
        id: sublocation.id,
        label: sublocation.label,
        subtitle: sublocation.subtitle,
        sceneImagePath: sublocation.sceneImagePath,
        availableNpcIds: [...sublocation.availableNpcIds],
        isReturnable: sublocation.isReturnable,
        entryActionLabel: sublocation.entryActionLabel,
        exitActionLabel: sublocation.exitActionLabel
      }))
    }))
  };
}

function loadWorldGuardCatalog(): WorldGuardCatalog {
  return JSON.parse(
    readFileSync(
      resolve(__dirname, "../../../assets/data/world-guards.json"),
      "utf8"
    )
  ) as WorldGuardCatalog;
}

function createFixture(options: {
  player?: typeof samplePlayer;
  graph?: WorldGraph;
  locationsCatalog?: WorldLocationsCatalog;
  guardCatalog?: WorldGuardCatalog;
} = {}): {
  roster: CharacterRosterService;
  service: WorldStateService;
} {
  const roster = new CharacterRosterService();
  const player = clonePlayer(options.player ?? samplePlayer);
  const graphLoader = {
    load: jest.fn(() => of(options.graph ?? loadWorldGraph()))
  };
  const locationsLoader = {
    load: jest.fn(() => of(options.locationsCatalog ?? loadWorldLocationsCatalog()))
  };
  const guardsLoader = {
    load: jest.fn(() => of(options.guardCatalog ?? loadWorldGuardCatalog()))
  };

  delete player.interactionState;
  roster.createCharacter(player);

  const actionInjector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster }
    ]
  });
  const gameAction = runInInjectionContext(
    actionInjector,
    () => new GameActionService()
  );
  const worldInjector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: GameActionService, useValue: gameAction },
      { provide: WorldGraphLoader, useValue: graphLoader },
      { provide: WorldGuardsLoader, useValue: guardsLoader },
      { provide: WorldLocationsLoader, useValue: locationsLoader }
    ]
  });

  return {
    roster,
    service: runInInjectionContext(worldInjector, () => new WorldStateService())
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
