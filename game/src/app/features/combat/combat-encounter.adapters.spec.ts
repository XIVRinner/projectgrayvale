import type { CombatRunState } from "@rinner/grayvale-core";
import { samplePlayer } from "@rinner/grayvale-core";

import { type SaveSlotHealthState } from "../../core/services/health-balance";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import {
  buildCombatEncounterBundle,
  buildCombatEncounterView,
  getCombatRoutePreview,
  isSupportedCombatActivity,
  mapCombatSkillIdToPlayerSkillId
} from "./combat-encounter.adapters";

const tutorialActivity: GameActivityDefinition = {
  id: "coyote_culling",
  name: "Cull the Coyote",
  description: "Push through the nerves and deal with the lone coyote stalking the lower path.",
  location: {
    locationId: "forest_edge"
  },
  tags: ["forest", "quest", "special", "tutorial"],
  governingAttributes: ["agility", "vitality"],
  difficulty: 6,
  questSignal: {
    type: "kill",
    target: "arkama_coyote",
    count: 1
  },
  rewards: []
};

const huntCoyoteActivity: GameActivityDefinition = {
  id: "hunt_coyote",
  name: "Hunt Coyote",
  description: "Track a meaner coyote through the brush and bring back something useful.",
  location: {
    locationId: "forest_edge"
  },
  tags: ["forest", "combat", "repeatable", "hunting", "t1"],
  governingAttributes: ["agility", "vitality"],
  difficulty: 7,
  rewards: []
};

describe("combat encounter adapters", () => {
  const health: SaveSlotHealthState = {
    currentHp: 84,
    maxHp: 84
  };

  it("flags the tutorial coyote activity as a supported combat encounter", () => {
    expect(isSupportedCombatActivity(tutorialActivity)).toBe(true);
    expect(isSupportedCombatActivity(huntCoyoteActivity)).toBe(true);
  });

  it("builds a combat encounter bundle tied to the active player", () => {
    const bundle = buildCombatEncounterBundle(tutorialActivity, samplePlayer, health);

    expect(bundle).not.toBeNull();
    expect(bundle?.activity.id).toBe("coyote_culling");
    expect(bundle?.activity.playerActorId).toBe(samplePlayer.id);
    expect(bundle?.player.displayName).toBe(samplePlayer.name);
    expect(bundle?.player.maxHp).toBe(84);
    expect(bundle?.rotationPreview.map((entry) => entry.abilityLabel)).toEqual(
      expect.arrayContaining(["Slashing Cut", "Piercing Finisher", "Instant Pierce"])
    );
  });

  it("builds the stronger repeatable hunt coyote encounter", () => {
    const bundle = buildCombatEncounterBundle(huntCoyoteActivity, samplePlayer, health);

    expect(bundle).not.toBeNull();
    expect(bundle?.activity.id).toBe("hunt_coyote");
    expect(bundle?.enemies[0]?.displayName).toBe("Hunting Coyote");
    expect(bundle?.enemies[0]?.maxHp).toBeGreaterThan(45);
  });

  it("exposes the compiled preview without an active encounter", () => {
    const preview = getCombatRoutePreview(samplePlayer, health);

    expect(preview.map((entry) => entry.abilityLabel)).toContain("Slashing Cut");
    expect(preview.some((entry) => entry.isReaction)).toBe(true);
  });

  it("shows active effect stack counts on combat actor cards", () => {
    const bundle = buildCombatEncounterBundle(tutorialActivity, samplePlayer, health);

    expect(bundle).not.toBeNull();

    const state: CombatRunState = {
      activityId: bundle!.activity.id,
      currentTick: 3,
      phase: "combat",
      actors: {
        [bundle!.player.id]: {
          actorId: bundle!.player.id,
          definitionId: bundle!.player.id,
          currentHp: bundle!.player.maxHp,
          maxHp: bundle!.player.maxHp,
          level: bundle!.player.level,
          tags: [...bundle!.player.tags],
          resources: {},
          activeEffects: [
            {
              effectId: "effect_piercing_talon",
              sourceActorId: bundle!.player.id,
              targetActorId: bundle!.player.id,
              stacks: 2
            }
          ],
          cooldowns: {},
          range: 0,
          defeated: false
        },
        [bundle!.enemies[0].id]: {
          actorId: bundle!.enemies[0].id,
          definitionId: bundle!.enemies[0].id,
          currentHp: bundle!.enemies[0].maxHp,
          maxHp: bundle!.enemies[0].maxHp,
          level: bundle!.enemies[0].level,
          tags: [...bundle!.enemies[0].tags],
          resources: {},
          activeEffects: [],
          cooldowns: {},
          range: 0,
          defeated: false
        }
      },
      logs: [],
      accumulatedDelta: {
        actorChanges: [],
        resourceChanges: [],
        effectsApplied: [],
        effectsExpired: [],
        xp: [],
        loot: [],
        penalties: []
      }
    };

    const view = buildCombatEncounterView(bundle!, state, [], "Blades are moving.");
    expect(view.player.effectLabels).toContain("Piercing Talon x2");
  });

  it("maps combat skill ids back into the game player skill ids", () => {
    expect(mapCombatSkillIdToPlayerSkillId("skill_short_blade")).toBe("short_blade");
    expect(mapCombatSkillIdToPlayerSkillId("skill_unknown")).toBeNull();
  });
});
