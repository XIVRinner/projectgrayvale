import { Injectable, computed, inject, signal } from "@angular/core";
import type { Player } from "@rinner/grayvale-core";
import {
  canMove,
  enterSublocation,
  hasSublocation,
  leaveSublocation,
  move,
  type WorldGraph
} from "@rinner/grayvale-worldgraph";
import { forkJoin } from "rxjs";

import { WorldGraphLoader } from "../../data/loaders/world-graph.loader";
import {
  type WorldGuardCatalog,
  WorldGuardsLoader
} from "../../data/loaders/world-guards.loader";
import {
  type WorldLocationMetadata,
  type WorldLocationsCatalog,
  type WorldSublocationMetadata,
  WorldLocationsLoader
} from "../../data/loaders/world-locations.loader";
import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
import { GameActionService } from "./game-action.service";
import type { SaveSlotWorldState } from "./world-state.models";
import {
  createWorldGuardResolver,
  validateWorldGuardCatalogUsage
} from "./world-guard-evaluator";

@Injectable({ providedIn: "root" })
export class WorldStateService {
  private readonly worldGraphLoader = inject(WorldGraphLoader);
  private readonly worldGuardsLoader = inject(WorldGuardsLoader);
  private readonly worldLocationsLoader = inject(WorldLocationsLoader);
  private readonly roster = inject(CharacterRosterService);
  private readonly debugLog = inject(DebugLogService);
  private readonly gameAction = inject(GameActionService);

  private readonly graphState = signal<WorldGraph | null>(null);
  private readonly guardCatalogState = signal<WorldGuardCatalog | null>(null);
  private readonly catalogState = signal<WorldLocationsCatalog | null>(null);
  private readonly loadErrorState = signal<string | null>(null);

  readonly loadError = this.loadErrorState.asReadonly();
  readonly isReady = computed(
    () =>
      this.graphState() !== null &&
      this.catalogState() !== null &&
      this.loadErrorState() === null
  );

  readonly worldGraph = computed(() => this.graphState());
  readonly worldGuardCatalog = computed(() => this.guardCatalogState());
  readonly worldLocationsCatalog = computed(() => this.catalogState());

  readonly currentWorld = computed(() => this.roster.activeWorld());

  readonly locationMetadataById = computed(() => {
    const catalog = this.catalogState();
    return new Map(
      catalog?.locations.map((location) => [location.id, location]) ?? []
    );
  });

  readonly currentLocationMetadata = computed<WorldLocationMetadata | null>(() => {
    const world = this.currentWorld();

    if (!world) {
      return null;
    }

    return this.locationMetadataById().get(world.currentLocation) ?? null;
  });

  readonly currentSublocationMetadata = computed<WorldSublocationMetadata | null>(() => {
    const currentSublocationId = this.currentWorld()?.sublocations.at(-1);
    const location = this.currentLocationMetadata();

    if (!currentSublocationId || !location) {
      return null;
    }

    return location.sublocations.find((entry) => entry.id === currentSublocationId) ?? null;
  });

  readonly currentLocationLabel = computed(
    () => this.currentLocationMetadata()?.label ?? null
  );

  readonly currentSublocationLabel = computed(
    () => this.currentSublocationMetadata()?.label ?? null
  );

  constructor() {
    forkJoin({
      graph: this.worldGraphLoader.load(),
      guards: this.worldGuardsLoader.load(),
      catalog: this.worldLocationsLoader.load()
    }).subscribe({
      next: ({ graph, guards, catalog }) => {
        validateWorldCatalog(graph, catalog);
        validateWorldGuardUsage(graph, guards, catalog);
        this.debugLog.logMessage("world", "Loaded world navigation data.", {
          locationCount: catalog.locations.length,
          edgeCount: graph.edges.length
        });
        this.graphState.set(graph);
        this.guardCatalogState.set(guards);
        this.catalogState.set(catalog);
        this.loadErrorState.set(null);
      },
      error: (error: unknown) => {
        this.debugLog.logMessage(
          "world",
          "Failed to load world navigation data.",
          errorToMessage(error)
        );
        this.graphState.set(null);
        this.guardCatalogState.set(null);
        this.catalogState.set(null);
        this.loadErrorState.set(errorToMessage(error));
      }
    });
  }

  executeTravel(
    fromLocationId: string,
    toLocationId: string
  ): boolean {
    const activeSlot = this.roster.activeSlot();
    const graph = this.graphState();
    const guardCatalog = this.guardCatalogState();
    const world = this.roster.activeWorld();

    if (!activeSlot || !graph || !guardCatalog || !world) {
      this.debugLog.logMessage("world", "Travel rejected: world data unavailable.", {
        fromLocationId,
        toLocationId
      });
      return false;
    }

    const guardContext = buildGuardContext(activeSlot.player, world);
    const guardResolver = createWorldGuardResolver(guardCatalog);

    if (!canMove(graph, fromLocationId, toLocationId, guardContext, guardResolver)) {
      this.debugLog.logMessage("world", "Travel rejected: guards blocked the route.", {
        fromLocationId,
        toLocationId
      });
      return false;
    }

    const nextWorld = move(world, toLocationId);

    return this.gameAction.executeWorldAction(
      {
        actionId: "travel-" + fromLocationId + "-to-" + toLocationId,
        actionKind: "world-travel",
        payload: { fromLocationId, targetLocationId: toLocationId }
      },
      nextWorld
    );
  }

  executeEnterSublocation(
    sublocationId: string
  ): boolean {
    const graph = this.graphState();
    const world = this.roster.activeWorld();

    if (!graph || !world) {
      this.debugLog.logMessage("world", "Sublocation enter rejected: world data unavailable.", {
        sublocationId
      });
      return false;
    }

    if (!hasSublocation(graph, world.currentLocation, sublocationId)) {
      this.debugLog.logMessage("world", "Sublocation enter rejected: sublocation not found.", {
        sublocationId,
        currentLocation: world.currentLocation
      });
      return false;
    }

    const nextWorld = enterSublocation(world, sublocationId);

    return this.gameAction.executeWorldAction(
      {
        actionId: "enter-" + sublocationId,
        actionKind: "sublocation-enter",
        payload: { sublocationId }
      },
      nextWorld
    );
  }

  executeExitSublocation(): boolean {
    const world = this.roster.activeWorld();

    if (!world) {
      this.debugLog.logMessage("world", "Sublocation exit rejected: no active world.");
      return false;
    }

    const currentSublocationId = world.sublocations.at(-1);

    if (!currentSublocationId) {
      this.debugLog.logMessage("world", "Sublocation exit rejected: not inside a sublocation.");
      return false;
    }

    const nextWorld = leaveSublocation(world);

    return this.gameAction.executeWorldAction(
      {
        actionId: "leave-" + currentSublocationId,
        actionKind: "sublocation-exit",
        payload: { sublocationId: currentSublocationId }
      },
      nextWorld
    );
  }
}

function validateWorldCatalog(graph: WorldGraph, catalog: WorldLocationsCatalog): void {
  const metadataById = new Map(catalog.locations.map((location) => [location.id, location]));

  for (const location of catalog.locations) {
    if (!graph.locations[location.id]) {
      throw new Error(`World metadata references unknown location "${location.id}".`);
    }
  }

  for (const locationId of Object.keys(graph.locations)) {
    const locationMetadata = metadataById.get(locationId);

    if (!locationMetadata) {
      throw new Error(`Missing world metadata for location "${locationId}".`);
    }

    const authoredSublocations = graph.locations[locationId]?.sublocations ?? [];

    for (const sublocation of locationMetadata.sublocations) {
      if (!authoredSublocations.includes(sublocation.id)) {
        throw new Error(
          `Sublocation "${sublocation.id}" is missing from graph location "${locationId}".`
        );
      }
    }
  }

  if (!graph.locations[catalog.defaultState.currentLocation]) {
    throw new Error(
      `Default world location "${catalog.defaultState.currentLocation}" does not exist in the graph.`
    );
  }

  for (const sublocationId of catalog.defaultState.sublocations) {
    if (!hasSublocation(graph, catalog.defaultState.currentLocation, sublocationId)) {
      throw new Error(
        `Default world sublocation "${sublocationId}" is not authored under "${catalog.defaultState.currentLocation}".`
      );
    }
  }
}

function validateWorldGuardUsage(
  graph: WorldGraph,
  catalog: WorldGuardCatalog,
  locationsCatalog: WorldLocationsCatalog
): void {
  for (const [locationId, location] of Object.entries(graph.locations)) {
    validateWorldGuardCatalogUsage(
      location.guards,
      catalog,
      "world graph.locations." + locationId
    );
  }

  for (const [index, edge] of graph.edges.entries()) {
    validateWorldGuardCatalogUsage(edge.guards, catalog, "world graph.edges[" + index + "]");
  }

  for (const location of locationsCatalog.locations) {
    for (const sublocation of location.sublocations) {
      validateWorldGuardCatalogUsage(
        sublocation.exitGuards,
        catalog,
        "world locations." + location.id + ".sublocations." + sublocation.id + ".exitGuards"
      );
    }
  }
}

function buildGuardContext(
  player: Player,
  world: SaveSlotWorldState
): { player: Player; npcs: Record<string, never>; world: { currentLocation: string; sublocations: string[] } } {
  return {
    player,
    npcs: {},
    world: {
      currentLocation: world.currentLocation,
      sublocations: [...world.sublocations]
    }
  };
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load world navigation data.";
}
