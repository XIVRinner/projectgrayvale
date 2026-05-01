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
        tags: ["recovery", "rest"],
        governingAttributes: ["vitality"],
        difficulty: 5
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
