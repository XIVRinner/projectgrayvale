import { Injector, runInInjectionContext } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

import { ActivitiesLoader } from "./activities.loader";

describe("ActivitiesLoader", () => {
  it("parses activities.json into authored activity definitions", async () => {
    const loader = createActivitiesLoader(
      JSON.parse(
        readFileSync(resolve(__dirname, "../../../assets/data/activities.json"), "utf8")
      ) as unknown
    );

    await expect(firstValueFrom(loader.load())).resolves.toEqual([
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
        description: "Carry timber, pull bent nails, and patch floors — whatever the village needs.",
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
      }
    ]);
  });
});

function createActivitiesLoader(payload: unknown): ActivitiesLoader {
  const http = {
    get: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }]
  });

  return runInInjectionContext(injector, () => new ActivitiesLoader());
}
