import { HttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { DefinitionRepositoryService } from "../../data/definition-repository.service";
import { ServerConnectionService } from "../../core/services/server-connection.service";
import { KairosEditService } from "./kairos-edit.service";

describe("KairosEditService", () => {
  it("filters tag options to the requested definition type", async () => {
    const http = {
      get: jest.fn(() =>
        of({
          categories: [
            {
              id: "inventory",
              label: "Inventory",
              allowedFor: ["items", "materials"],
              tags: [
                { id: "starter", label: "Starter", description: "Starter content" },
              ],
            },
            {
              id: "actions",
              label: "Actions",
              allowedFor: ["actions"],
              tags: [{ id: "instant", label: "Instant", description: "Instant action" }],
            },
          ],
        }),
      ),
      put: jest.fn(),
    } satisfies Pick<HttpClient, "get" | "put">;

    const service = createService(http);

    await expect(service.getTagOptions("items")).resolves.toEqual([
      {
        id: "starter",
        label: "Starter",
        description: "Starter content",
        categoryId: "inventory",
        categoryLabel: "Inventory",
      },
    ]);
  });

  it("saves a definition through the admin endpoint and invalidates caches", async () => {
    const http = {
      get: jest.fn(),
      put: jest.fn(() =>
        of({
          id: "weapon_dagger_rustleaf",
          hash: "hash-1",
          version: "hash-1",
          updatedAt: "2026-05-12T00:00:00.000Z",
          definition: {
            id: "weapon_dagger_rustleaf",
            name: "Old Dagger",
          },
        }),
      ),
    } satisfies Pick<HttpClient, "get" | "put">;
    const definitionRepository = {
      invalidateDefinition: jest.fn(() => Promise.resolve()),
    } as Pick<DefinitionRepositoryService, "invalidateDefinition">;

    await TestBed.configureTestingModule({
      providers: [
        KairosEditService,
        { provide: HttpClient, useValue: http },
        {
          provide: ServerConnectionService,
          useValue: {
            serverApiUrl: (path: `/api/${string}`) => path,
          },
        },
        { provide: DefinitionRepositoryService, useValue: definitionRepository },
      ],
    });

    const service = TestBed.inject(KairosEditService);

    await expect(
      service.saveDefinition(
        "items",
        {
          id: "weapon_dagger_rustleaf",
          name: "Old Dagger",
        },
        "weapon_dagger_old",
      ),
    ).resolves.toEqual({
      id: "weapon_dagger_rustleaf",
      name: "Old Dagger",
    });

    expect(http.put).toHaveBeenCalledWith(
      "/api/admin/definitions/items/weapon_dagger_rustleaf",
      {
        definition: {
          id: "weapon_dagger_rustleaf",
          name: "Old Dagger",
        },
      },
      {
        withCredentials: true,
      },
    );
    expect(definitionRepository.invalidateDefinition).toHaveBeenNthCalledWith(
      1,
      "items",
      "weapon_dagger_old",
    );
    expect(definitionRepository.invalidateDefinition).toHaveBeenNthCalledWith(
      2,
      "items",
      "weapon_dagger_rustleaf",
    );
  });
});

function createService(http: Pick<HttpClient, "get" | "put">): KairosEditService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      KairosEditService,
      { provide: HttpClient, useValue: http },
      {
        provide: ServerConnectionService,
        useValue: {
          serverApiUrl: (path: `/api/${string}`) => path,
        },
      },
      {
        provide: DefinitionRepositoryService,
        useValue: {
          invalidateDefinition: jest.fn(() => Promise.resolve()),
        },
      },
    ],
  });

  return TestBed.inject(KairosEditService);
}
