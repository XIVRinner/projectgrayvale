import { Injector, runInInjectionContext } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

import { QuestsLoader } from "./quests.loader";

describe("QuestsLoader", () => {
  it("parses quests.json into authored quest definitions", async () => {
    const loader = createQuestsLoader(
      JSON.parse(
        readFileSync(resolve(__dirname, "../../../assets/data/quests.json"), "utf8")
      ) as unknown
    );

    await expect(firstValueFrom(loader.load())).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "quest_recovery",
          objectives: [
            {
              type: "attribute_reached",
              attribute: "vitality",
              target: 10
            }
          ]
        }),
        expect.objectContaining({
          id: "quest_chief_labour",
          steps: [
            {
              id: "build_strength",
              label: "Reach 10.0 Strength",
              objectives: [
                {
                  type: "attribute_reached",
                  attribute: "strength",
                  target: 10
                }
              ],
              rewards: [
                {
                  type: "activity_availability",
                  activityId: "village-labour",
                  status: "locked"
                }
              ]
            },
            {
              id: "report_to_chief",
              label: "Speak to the Chief",
              completion: "manual"
            }
          ]
        })
      ])
    );
  });
});

function createQuestsLoader(payload: unknown): QuestsLoader {
  const http = {
    get: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }]
  });

  return runInInjectionContext(injector, () => new QuestsLoader());
}
