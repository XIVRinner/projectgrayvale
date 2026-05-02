import { Injectable, computed, inject, signal } from "@angular/core";
import {
  canMove,
  enterSublocation,
  type Guard,
  type GuardContext,
  hasSublocation,
  leaveSublocation,
  move,
  type WorldGraph
} from "@rinner/grayvale-worldgraph";
import { forkJoin } from "rxjs";

import {
  WorldGraphLoader
} from "../../data/loaders/world-graph.loader";
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
import { GameActionService } from "./game-action.service";
import {
  createWorldGuardResolver,
  evaluateWorldGuardsDetailed,
  validateWorldGuardCatalogUsage
} from "./world-guard-evaluator";
import {
  buildActionPanelGroup,
  mergeActionPanelGroups,
  type ActionPanelGroupView
} from "../../shared/models/action-panel-group.model";

export type WorldActionKind = "sublocation-enter" | "sublocation-exit" | "world-travel";

export interface WorldActionView {
  readonly id: string;
  readonly label: string;
  readonly kind: WorldActionKind;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly payload?: Record<string, string | number | boolean>;
}

export interface WorldActionGroupView extends ActionPanelGroupView<WorldActionView> {}

@Injectable({ providedIn: "root" })
export class WorldStateService {
  private readonly worldGraphLoader = inject(WorldGraphLoader);
  private readonly worldGuardsLoader = inject(WorldGuardsLoader);
  private readonly worldLocationsLoader = inject(WorldLocationsLoader);
  private readonly roster = inject(CharacterRosterService);
  private readonly gameAction = inject(GameActionService);

  private readonly graphState = signal<WorldGraph | null>(null);
  private readonly guardCatalogState = signal<WorldGuardCatalog | null>(null);
  private readonly catalogState = signal<WorldLocationsCatalog | null>(null);
  private readonly loadErrorState = signal<string | null>(null);

  readonly loadError = this.loadErrorState.asReadonly();
  readonly isReady = computed(
    () => this.graphState() !== null && this.catalogState() !== null && this.loadErrorState() === null
  );

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

  readonly actionGroups = computed<readonly WorldActionGroupView[]>(() => {
    const activeSlot = this.roster.activeSlot();
    const guardCatalog = this.guardCatalogState();
    const graph = this.graphState();
    const location = this.currentLocationMetadata();
    const world = this.currentWorld();

    if (!activeSlot || !graph || !guardCatalog || !location || !world) {
      return [];
    }

    const currentSublocation = this.currentSublocationMetadata();

    if (currentSublocation) {
      return [
        buildActionPanelGroup("movement", [
          {
            id: buildExitSublocationActionId(currentSublocation.id),
            label:
              currentSublocation.exitActionLabel ?? `Leave ${currentSublocation.label}`,
            kind: "sublocation-exit",
            payload: {
              sublocationId: currentSublocation.id
            }
          }
        ])
      ];
    }

    const localChoices = location.sublocations
      .filter((entry) => entry.isReturnable)
      .map<WorldActionView>((entry) => ({
        id: buildEnterSublocationActionId(entry.id),
        label: entry.entryActionLabel ?? `Enter ${entry.label}`,
        kind: "sublocation-enter",
        payload: {
          sublocationId: entry.id
        }
      }));
    const guardContext = buildGuardContext(activeSlot.player, world);
    const travelChoices = graph.edges
      .filter((edge) => edge.from === world.currentLocation)
      .map<WorldActionView | null>((edge) => {
        const destination = this.locationMetadataById().get(edge.to);
        const destinationLocation = graph.locations[edge.to];

        if (!destination || !destinationLocation) {
          return null;
        }
        const access = evaluateTravelAccess(
          edge,
          destinationLocation.guards,
          guardContext,
          guardCatalog
        );

        return {
          id: buildTravelActionId(edge.from, edge.to),
          label: `Travel to ${destination.label}`,
          kind: "world-travel",
          disabled: !access.passes,
          disabledReason: access.failureReason,
          payload: {
            fromLocationId: edge.from,
            targetLocationId: edge.to
          }
        };
      })
      .filter((entry): entry is WorldActionView => entry !== null);

    return mergeActionPanelGroups<WorldActionView>([
      {
        kind: "movement",
        choices: localChoices
      },
      {
        kind: "travel",
        choices: travelChoices
      }
    ]);
  });

  private readonly actionsById = computed(() => {
    const entries = this.actionGroups().flatMap((group) =>
      group.choices.map((choice) => [choice.id, choice] as const)
    );

    return new Map(entries);
  });

  constructor() {
    forkJoin({
      graph: this.worldGraphLoader.load(),
      guards: this.worldGuardsLoader.load(),
      catalog: this.worldLocationsLoader.load()
    }).subscribe({
      next: ({ graph, guards, catalog }) => {
        validateWorldCatalog(graph, catalog);
        validateWorldGuardUsage(graph, guards);
        this.graphState.set(graph);
        this.guardCatalogState.set(guards);
        this.catalogState.set(catalog);
        this.loadErrorState.set(null);
      },
      error: (error: unknown) => {
        this.graphState.set(null);
        this.guardCatalogState.set(null);
        this.catalogState.set(null);
        this.loadErrorState.set(errorToMessage(error));
      }
    });
  }

  executeAction(actionId: string): boolean {
    const action = this.actionsById().get(actionId);

    if (!action || action.disabled) {
      return false;
    }

    return this.gameAction.execute(
      {
        actionId: action.id,
        actionKind: action.kind,
        payload: action.payload
      },
      () => this.applyAction(action)
    );
  }

  private applyAction(action: WorldActionView): void {
    const activeSlot = this.roster.activeSlot();
    const graph = this.graphState();
    const guardCatalog = this.guardCatalogState();
    const world = this.currentWorld();

    if (!activeSlot || !graph || !guardCatalog || !world) {
      return;
    }

    switch (action.kind) {
      case "sublocation-enter": {
        const targetSublocationId = action.payload?.["sublocationId"];

        if (typeof targetSublocationId !== "string") {
          return;
        }

        if (!hasSublocation(graph, world.currentLocation, targetSublocationId)) {
          return;
        }

        this.roster.updateActiveWorld(enterSublocation(world, targetSublocationId));
        return;
      }
      case "sublocation-exit":
        this.roster.updateActiveWorld(leaveSublocation(world));
        return;
      case "world-travel": {
        const targetLocationId = action.payload?.["targetLocationId"];

        if (typeof targetLocationId !== "string") {
          return;
        }

        const guardContext = buildGuardContext(activeSlot.player, world);
        const guardResolver = createWorldGuardResolver(guardCatalog);

        if (!canMove(graph, world.currentLocation, targetLocationId, guardContext, guardResolver)) {
          return;
        }

        this.roster.updateActiveWorld(move(world, targetLocationId));
        return;
      }
    }
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

function validateWorldGuardUsage(graph: WorldGraph, catalog: WorldGuardCatalog): void {
  for (const [locationId, location] of Object.entries(graph.locations)) {
    validateWorldGuardCatalogUsage(location.guards, catalog, `world graph.locations.${locationId}`);
  }

  for (const [index, edge] of graph.edges.entries()) {
    validateWorldGuardCatalogUsage(edge.guards, catalog, `world graph.edges[${index}]`);
  }
}

function buildGuardContext(player: GuardContext["player"], world: GuardContext["world"]): GuardContext {
  return {
    player,
    npcs: {},
    world: {
      currentLocation: world.currentLocation,
      sublocations: [...world.sublocations]
    }
  };
}

function evaluateTravelAccess(
  edge: WorldGraph["edges"][number],
  destinationGuards: readonly Guard[] | undefined,
  context: GuardContext,
  guardCatalog: WorldGuardCatalog
): {
  readonly passes: boolean;
  readonly failureReason?: string;
} {
  const edgeResult = evaluateWorldGuardsDetailed(edge.guards, context, guardCatalog);

  if (!edgeResult.passes) {
    return edgeResult;
  }

  return evaluateWorldGuardsDetailed(
    destinationGuards,
    context,
    guardCatalog
  );
}

function buildEnterSublocationActionId(sublocationId: string): string {
  return `enter-${sublocationId}`;
}

function buildExitSublocationActionId(sublocationId: string): string {
  return `leave-${sublocationId}`;
}

function buildTravelActionId(fromLocationId: string, toLocationId: string): string {
  return `travel-${fromLocationId}-to-${toLocationId}`;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load world navigation data.";
}
