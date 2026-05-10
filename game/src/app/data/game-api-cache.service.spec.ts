import { HttpClient, HttpHeaders, HttpResponse } from "@angular/common/http";
import { Injector, runInInjectionContext } from "@angular/core";
import { firstValueFrom, of, throwError } from "rxjs";

import { GameApiCacheService } from "./game-api-cache.service";

describe("GameApiCacheService", () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: originalIndexedDb
    });
  });

  it("reuses a fresh cached API response for repeat reads", async () => {
    const http = {
      get: jest.fn(() =>
        of(
          new HttpResponse({
            body: [{ id: "weapon_dagger_rustleaf", name: "Old Dagger" }],
            headers: new HttpHeaders({ ETag: '"items-v1"' })
          })
        )
      )
    };
    const service = createCacheService(http);

    await expect(firstValueFrom(service.getJson("/api/items"))).resolves.toEqual([
      { id: "weapon_dagger_rustleaf", name: "Old Dagger" }
    ]);
    await expect(firstValueFrom(service.getJson("/api/items"))).resolves.toEqual([
      { id: "weapon_dagger_rustleaf", name: "Old Dagger" }
    ]);

    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it("uses a separate API cache namespace instead of the save-slot storage key", async () => {
    const http = {
      get: jest.fn(() =>
        of(
          new HttpResponse({
            body: [{ id: "quest_recovery" }]
          })
        )
      )
    };
    const service = createCacheService(http);

    await firstValueFrom(service.getJson("/api/quests"));

    expect(Object.keys(localStorage).some((key) => key.startsWith("grayvale:api-cache:v1:"))).toBe(
      true
    );
    expect(localStorage.getItem("grayvale:save-slots:v1")).toBeNull();
  });

  it("falls back to the persisted cache when the network request fails", async () => {
    const http = {
      get: jest
        .fn()
        .mockReturnValueOnce(
          of(
            new HttpResponse({
              body: [{ id: "village-chief", name: "Village Chief" }]
            })
          )
        )
        .mockReturnValueOnce(throwError(() => new Error("Network down")))
    };
    const service = createCacheService(http);

    await firstValueFrom(service.getJson("/api/dialogue-actors", { ttlMs: -1 }));

    await expect(
      firstValueFrom(service.getJson("/api/dialogue-actors", { ttlMs: -1 }))
    ).resolves.toEqual([{ id: "village-chief", name: "Village Chief" }]);
  });
});

function createCacheService(http: Pick<HttpClient, "get">): GameApiCacheService {
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }]
  });

  return runInInjectionContext(injector, () => new GameApiCacheService());
}
