import type { Guard, GuardContext, GuardResolver } from "@rinner/grayvale-worldgraph";

import type { WorldGuardCatalog, WorldGuardDefinition } from "../../data/loaders/world-guards.loader";

export interface WorldGuardEvaluationResult {
  readonly passes: boolean;
  readonly failureReason?: string;
}

export function createWorldGuardResolver(catalog: WorldGuardCatalog): GuardResolver {
  return (guard, context) => evaluateWorldGuard(guard, context, catalog).passes;
}

export function evaluateWorldGuard(
  guard: Guard,
  context: GuardContext,
  catalog: WorldGuardCatalog
): WorldGuardEvaluationResult {
  const definition = catalog.guards.find((entry) => entry.type === guard.type);

  if (!definition) {
    return {
      passes: false,
      failureReason: `Unknown world guard "${guard.type}".`
    };
  }

  const passes = evaluateKnownGuard(guard, context);

  if (passes) {
    return { passes: true };
  }

  return {
    passes: false,
    failureReason: renderGuardFailureMessage(definition, guard.params)
  };
}

export function evaluateWorldGuardsDetailed(
  guards: readonly Guard[] | undefined,
  context: GuardContext,
  catalog: WorldGuardCatalog
): WorldGuardEvaluationResult {
  if (!guards || guards.length === 0) {
    return { passes: true };
  }

  for (const guard of guards) {
    const result = evaluateWorldGuard(guard, context, catalog);

    if (!result.passes) {
      return result;
    }
  }

  return { passes: true };
}

export function validateWorldGuardCatalogUsage(
  guards: readonly Guard[] | undefined,
  catalog: WorldGuardCatalog,
  label: string
): void {
  if (!guards || guards.length === 0) {
    return;
  }

  for (const [index, guard] of guards.entries()) {
    if (!catalog.guards.some((definition) => definition.type === guard.type)) {
      throw new Error(`${label}.guards[${index}] references unknown guard "${guard.type}".`);
    }
  }
}

function evaluateKnownGuard(guard: Guard, context: GuardContext): boolean {
  switch (guard.type) {
    case "player_level_at_least":
      return context.player.progression.level >= readNumericParam(guard.params, "minimumLevel");
    case "adventurer_rank_at_least":
      return context.player.adventurerRank >= readNumericParam(guard.params, "minimumRank");
    case "story_chapter_at_least": {
      const minimumChapter = readNumericParam(guard.params, "minimumChapter");
      const requiredArcId = readOptionalStringParam(guard.params, "arcId");
      const story = context.player.story;

      if (!story) {
        return false;
      }

      if (requiredArcId && story.currentArcId !== requiredArcId) {
        return false;
      }

      return story.currentChapter >= minimumChapter;
    }
    default:
      return false;
  }
}

function renderGuardFailureMessage(
  definition: WorldGuardDefinition,
  params: Record<string, unknown> | undefined
): string {
  return definition.failureMessageTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const value = params?.[token];

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return `{${token}}`;
  });
}

function readNumericParam(params: Record<string, unknown> | undefined, key: string): number {
  const value = params?.[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    return Number.POSITIVE_INFINITY;
  }

  return value;
}

function readOptionalStringParam(
  params: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value;
}
