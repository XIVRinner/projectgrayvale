import { Injector, runInInjectionContext } from "@angular/core";
import { samplePlayer } from "@rinner/grayvale-core";
import type { Guard, WorldGraph } from "@rinner/grayvale-worldgraph";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { of } from "rxjs";

import type { WorldGuardCatalog } from "../../data/loaders/world-guards.loader";
import { WorldGuardsLoader } from "../../data/loaders/world-guards.loader";
import type { WorldLocationsCatalog } from "../../data/loaders/world-locations.loader";
import { WorldGraphLoader } from "../../data/loaders/world-graph.loader";
import { WorldLocationsLoader } from "../../data/loaders/world-locations.loader";
import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
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

  it("exposes loaded world graph, guard catalog, and location catalog via signals", () => {
    expect(service.isReady()).toBe(true);
    expect(service.worldGraph()).not.toBeNull();
    expect(service.worldGuardCatalog()).not.toBeNull();
    expect(service.worldLocationsCatalog()).not.toBeNull();
  });

  it("reports current location and sublocation labels", () => {
    expect(service.currentLocationLabel()).toBe("Arkama Village");
    expect(service.currentSublocationLabel()).toBe("Chief House");
  });

  it("executes sublocation exit and moves the player out", () => {
    const executed = service.executeExitSublocation();

    expect(executed).toBe(true);
    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: []
    });
  });

  it("records a button-press interaction when exiting chief-house", () => {
    service.executeExitSublocation();
    const activePlayer = roster.activeCharacter();

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

  it("supports entering a sublocation", () => {
    service.executeExitSublocation();

    const entered = service.executeEnterSublocation("tavern");

    expect(entered).toBe(true);
    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: ["tavern"]
    });
    expect(service.currentSublocationLabel()).toBe("Tavern");
  });

  it("rejects entering a sublocation that does not exist in the graph", () => {
    service.executeExitSublocation();

    const entered = service.executeEnterSublocation("nonexistent-sublocation");

    expect(entered).toBe(false);
  });

  it("supports travel between locations", () => {
    service.executeExitSublocation();

    const traveled = service.executeTravel("village-arkama", "camp");

    expect(traveled).toBe(true);
    expect(roster.activeWorld()).toEqual({
      currentLocation: "camp",
      sublocations: []
    });
    expect(service.currentLocationLabel()).toBe("Camp");
    expect(service.currentSublocationLabel()).toBeNull();
  });

  it("records button-press interaction history across multiple movements", () => {
    service.executeExitSublocation();
    service.executeTravel("village-arkama", "camp");
    service.executeTravel("camp", "village-arkama");

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

  it("rejects travel when guards block the route", () => {
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

    service.executeExitSublocation();

    const traveled = service.executeTravel("village-arkama", "camp");

    expect(traveled).toBe(false);
    expect(roster.activeWorld()).toEqual({
      currentLocation: "village-arkama",
      sublocations: []
    });
    expect(roster.activeCharacter()?.interactionState?.totalButtonPresses).toBe(1);
  });
});

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
        exitGuards?: Array<{ type: string; params?: Record<string, unknown> }>;
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
        exitActionLabel: sublocation.exitActionLabel,
        exitGuards: sublocation.exitGuards as Guard[] | undefined
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
  const debugLog = {
    logMessage: jest.fn(),
    logRaw: jest.fn(),
    log$: of([]),
    entries$: of([])
  };

  delete player.interactionState;
  roster.createCharacter(player);

  const actionInjector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: DebugLogService, useValue: debugLog }
    ]
  });
  const gameAction = runInInjectionContext(
    actionInjector,
    () => new GameActionService()
  );
  const worldInjector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: DebugLogService, useValue: debugLog },
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
