import { HttpClient } from "@angular/common/http";
import { Injector, runInInjectionContext } from "@angular/core";
import { of } from "rxjs";

import { DefinitionRepositoryService } from "./definition-repository.service";

describe("DefinitionRepositoryService", () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: originalIndexedDb,
    });
  });

  it("caches fetched item definitions and skips repeat batch fetches when metadata is unchanged", async () => {
    const http = {
      get: jest.fn(),
      post: jest.fn((url: string) => {
        if (url.endsWith("/api/definitions/items/info")) {
          return of([
            {
              id: "weapon_dagger_rustleaf",
              hash: "items-v1",
              version: "items-v1",
              updatedAt: "2026-05-12T00:00:00.000Z",
            },
          ]);
        }

        if (url.endsWith("/api/definitions/items/batch")) {
          return of([
            {
              id: "weapon_dagger_rustleaf",
              hash: "items-v1",
              version: "items-v1",
              updatedAt: "2026-05-12T00:00:00.000Z",
              definition: {
                id: "weapon_dagger_rustleaf",
                name: "Old Dagger",
                category: "equipment",
                rarity: "uncommon",
                imageId: "weapon_dagger_rustleaf",
                tags: ["dagger"],
                slot: "main_hand",
                itemLevel: 1,
                requirements: { levelRequirement: 1 },
                combatStats: [{ stat: "dodge_chance", value: 0.04, operation: "add" }],
                tooltip: { statLines: ["+4% Dodge Chance"] },
                damage: {
                  piercing: { min: 5, max: 10 },
                },
              },
            },
          ]);
        }

        throw new Error(`Unexpected POST ${url}`);
      }),
    } satisfies Pick<HttpClient, "get" | "post">;

    const service = createService(http);

    const first = await service.getItems(["weapon_dagger_rustleaf"]);
    const second = await service.getItems(["weapon_dagger_rustleaf"]);

    expect(first[0]?.id).toBe("weapon_dagger_rustleaf");
    expect(first[0]?.imageId).toBe("weapon_dagger_rustleaf");
    expect(second[0]?.id).toBe("weapon_dagger_rustleaf");
    expect(http.post).toHaveBeenCalledTimes(3);
    expect(http.post).toHaveBeenCalledWith(
      "/api/definitions/items/batch",
      ["weapon_dagger_rustleaf"],
    );
  });
});

function createService(http: Pick<HttpClient, "get" | "post">): DefinitionRepositoryService {
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }],
  });

  return runInInjectionContext(injector, () => new DefinitionRepositoryService());
}
