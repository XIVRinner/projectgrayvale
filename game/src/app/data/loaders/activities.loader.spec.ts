import { Injector, runInInjectionContext } from "@angular/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

import { GameApiCacheService } from "../game-api-cache.service";
import { ActivitiesLoader } from "./activities.loader";

describe("ActivitiesLoader", () => {
  it("parses activities.json into authored activity definitions", async () => {
    const loader = createActivitiesLoader(
      JSON.parse(
        readFileSync(resolve(__dirname, "../../../assets/data/activities.json"), "utf8")
      ) as unknown
    );

    await expect(firstValueFrom(loader.load())).resolves.toEqual(
      expect.arrayContaining([
        {
          id: "recover",
          name: "Recover",
          description: "Steady your breathing and let the worst of the pain pass.",
          location: {
            locationId: "village-arkama",
            sublocationId: "chief-house"
          },
          tags: ["recovery", "rest"],
          governingAttributes: ["vitality"],
          difficulty: 5,
          rewards: [
            {
              type: "attribute",
              targetId: "vitality",
              value: {
                type: "flat",
                amount: 0.5
              },
              distribution: {
                type: "deterministic"
              }
            }
          ]
        },
        {
          id: "village-labour",
          name: "Help with Village Labour",
          description: "Carry timber, pull bent nails, and patch floors - whatever the village needs.",
          location: {
            locationId: "village-arkama",
            sublocationId: undefined
          },
          tags: ["labour", "village"],
          governingAttributes: ["strength"],
          difficulty: 5,
          rewards: [
            {
              type: "attribute",
              targetId: "strength",
              value: {
                type: "flat",
                amount: 0.5
              },
              distribution: {
                type: "deterministic"
              }
            }
          ]
        },
        {
          id: "coyote_culling",
          name: "Cull the Coyote",
          description: "Push through the nerves and deal with the lone coyote stalking the lower path.",
          location: {
            locationId: "forest_edge",
            sublocationId: undefined
          },
          questSignal: {
            type: "kill",
            target: "arkama_coyote",
            count: 1
          },
          tags: ["forest", "quest", "special", "tutorial"],
          governingAttributes: ["agility", "vitality"],
          difficulty: 6,
          rewards: [
            {
              type: "attribute",
              targetId: "agility",
              value: {
                type: "flat",
                amount: 0.5
              },
              distribution: {
                type: "deterministic"
              }
            }
          ]
        },
        {
          id: "hunt_coyote",
          name: "Hunt Coyote",
          description: "Track a meaner coyote through the brush and bring back something useful.",
          location: {
            locationId: "forest_edge",
            sublocationId: undefined
          },
          tags: ["forest", "combat", "repeatable", "hunting", "t1"],
          governingAttributes: ["agility", "vitality"],
          difficulty: 7,
          rewards: expect.arrayContaining([
            expect.objectContaining({
              type: "item",
              targetId: "mat_coyote_hide_t1"
            }),
            expect.objectContaining({
              type: "item",
              targetId: "weapon_dagger_coyote_fang"
            })
          ])
        }
      ])
    );
  });
});

function createActivitiesLoader(payload: unknown): ActivitiesLoader {
  const apiCache = {
    getJsonWithFallback: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: GameApiCacheService, useValue: apiCache }]
  });

  return runInInjectionContext(injector, () => new ActivitiesLoader());
}
