import { HttpClient } from "@angular/common/http";
import { Injector, runInInjectionContext } from "@angular/core";
import { of } from "rxjs";

import { DefinitionImageService } from "./definition-image.service";

describe("DefinitionImageService", () => {
  const originalIndexedDb = globalThis.indexedDB;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined,
    });
    URL.createObjectURL = jest.fn(() => "blob:grayvale-test");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: originalIndexedDb,
    });
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it("caches fetched asset blobs and reuses them when metadata hash is unchanged", async () => {
    const http = {
      get: jest.fn((url: string, options?: { responseType?: string }) => {
        if (url.endsWith("/api/assets/items/weapon_dagger_rustleaf/info")) {
          return of({
            id: "weapon_dagger_rustleaf",
            hash: "asset-v1",
            contentType: "image/svg+xml",
            updatedAt: "2026-05-12T00:00:00.000Z",
          });
        }

        if (url.endsWith("/api/assets/items/weapon_dagger_rustleaf") && options?.responseType === "blob") {
          return of(new Blob(["svg"], { type: "image/svg+xml" }));
        }

        throw new Error(`Unexpected GET ${url}`);
      }),
    } satisfies Pick<HttpClient, "get">;

    const service = createService(http);

    await expect(service.getImageUrl("items", "weapon_dagger_rustleaf")).resolves.toBe("blob:grayvale-test");
    await expect(service.getImageUrl("items", "weapon_dagger_rustleaf")).resolves.toBe("blob:grayvale-test");

    expect(http.get).toHaveBeenCalledTimes(3);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});

function createService(http: Pick<HttpClient, "get">): DefinitionImageService {
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }],
  });

  return runInInjectionContext(injector, () => new DefinitionImageService());
}
