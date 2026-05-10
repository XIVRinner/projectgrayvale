import { Injector, runInInjectionContext } from "@angular/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

import { GameApiCacheService } from "../game-api-cache.service";
import { WorldLocationsLoader } from "./world-locations.loader";

describe("WorldLocationsLoader", () => {
  it("parses the document-style world-locations payload via API fallback", async () => {
    const payload = JSON.parse(
      readFileSync(resolve(__dirname, "../../../assets/data/world-locations.json"), "utf8")
    ) as unknown;
    const loader = createWorldLocationsLoader(payload);

    await expect(firstValueFrom(loader.load())).resolves.toEqual({
      defaultState: {
        currentLocation: "village-arkama",
        sublocations: ["chief-house"]
      },
      locations: expect.arrayContaining([
        expect.objectContaining({
          id: "village-arkama",
          label: "Arkama Village"
        }),
        expect.objectContaining({
          id: "forest_edge",
          label: "Forest Edge"
        })
      ])
    });
  });
});

function createWorldLocationsLoader(payload: unknown): WorldLocationsLoader {
  const apiCache = {
    getJsonWithFallback: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: GameApiCacheService, useValue: apiCache }]
  });

  return runInInjectionContext(injector, () => new WorldLocationsLoader());
}
