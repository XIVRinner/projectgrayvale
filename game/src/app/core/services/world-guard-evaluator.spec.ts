import { samplePlayer } from "@rinner/grayvale-core";
import type { GuardContext } from "@rinner/grayvale-worldgraph";

import type { WorldGuardCatalog } from "../../data/loaders/world-guards.loader";
import {
  createWorldGuardResolver,
  evaluateWorldGuard,
  evaluateWorldGuardsDetailed
} from "./world-guard-evaluator";

const catalog: WorldGuardCatalog = {
  guards: [
    {
      type: "player_level_at_least",
      failureMessageTemplate: "Reach level {minimumLevel} before traveling there."
    },
    {
      type: "adventurer_rank_at_least",
      failureMessageTemplate: "Reach adventurer rank {minimumRank} before traveling there."
    },
    {
      type: "story_chapter_at_least",
      failureMessageTemplate: "Advance the story to chapter {minimumChapter} before traveling there."
    }
  ]
};

describe("world guard evaluator", () => {
  it("passes a player level guard when the player meets the requirement", () => {
    const context = createContext({
      progression: {
        level: 3,
        experience: 0
      }
    });

    expect(
      evaluateWorldGuard(
        {
          type: "player_level_at_least",
          params: {
            minimumLevel: 2
          }
        },
        context,
        catalog
      )
    ).toEqual({ passes: true });
  });

  it("returns a failure reason when a progression guard fails", () => {
    const context = createContext();

    expect(
      evaluateWorldGuard(
        {
          type: "adventurer_rank_at_least",
          params: {
            minimumRank: 3
          }
        },
        context,
        catalog
      )
    ).toEqual({
      passes: false,
      failureReason: "Reach adventurer rank 3 before traveling there."
    });
  });

  it("supports story chapter gates with optional arc matching", () => {
    const context = createContext({
      story: {
        currentArcId: "prologue",
        currentChapter: 2,
        completedChapters: [1]
      }
    });

    expect(
      evaluateWorldGuard(
        {
          type: "story_chapter_at_least",
          params: {
            arcId: "prologue",
            minimumChapter: 2
          }
        },
        context,
        catalog
      )
    ).toEqual({ passes: true });
  });

  it("fails safely for unknown guards in the resolver contract", () => {
    const resolver = createWorldGuardResolver(catalog);

    expect(
      resolver(
        {
          type: "unknown_guard"
        },
        createContext()
      )
    ).toBe(false);
  });

  it("returns the first failing reason across multiple guards", () => {
    const context = createContext();

    expect(
      evaluateWorldGuardsDetailed(
        [
          {
            type: "player_level_at_least",
            params: {
              minimumLevel: 2
            }
          },
          {
            type: "adventurer_rank_at_least",
            params: {
              minimumRank: 2
            }
          }
        ],
        context,
        catalog
      )
    ).toEqual({
      passes: false,
      failureReason: "Reach level 2 before traveling there."
    });
  });
});

function createContext(
  overrides: Partial<GuardContext["player"]> = {}
): GuardContext {
  return {
    player: {
      ...cloneValue(samplePlayer),
      progression: {
        level: 1,
        experience: 0
      },
      adventurerRank: 1,
      ...overrides
    },
    npcs: {},
    world: {
      currentLocation: "village-arkama",
      sublocations: []
    }
  };
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
