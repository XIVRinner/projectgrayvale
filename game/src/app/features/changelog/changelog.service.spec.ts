import { HttpClient } from "@angular/common/http";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { ServerConnectionService } from "../../core/services/server-connection.service";
import { ChangelogService } from "./changelog.service";

describe("ChangelogService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("stores and reuses an anonymous client id for unread count requests", async () => {
    const http = {
      get: jest.fn().mockReturnValue(of({ count: 3 })),
      post: jest.fn(),
    } satisfies Pick<HttpClient, "get" | "post">;
    const serverConnection = createServerConnectionMock(null);
    const service = createService(http, serverConnection);

    await expect(service.fetchUnreadCount()).resolves.toBe(3);

    const storedClientId = localStorage.getItem("grayvale:changelog-client-id:v1");
    expect(typeof storedClientId).toBe("string");
    expect(storedClientId?.length).toBeGreaterThan(0);
    expect(http.get).toHaveBeenCalledWith(
      "/api/changelog/unread-count",
      expect.objectContaining({
        params: expect.objectContaining({
          clientId: storedClientId,
        }),
        withCredentials: true,
      }),
    );
  });

  it("omits anonymous clientId when a player session exists", async () => {
    const http = {
      get: jest.fn().mockReturnValue(of({ count: 1 })),
      post: jest.fn(),
    } satisfies Pick<HttpClient, "get" | "post">;
    const serverConnection = createServerConnectionMock("player-123");
    const service = createService(http, serverConnection);

    await service.fetchUnreadCount();

    expect(http.get).toHaveBeenCalledWith(
      "/api/changelog/unread-count",
      expect.objectContaining({
        params: {},
        withCredentials: true,
      }),
    );
  });

  it("sends anonymous clientId when marking a release as read", async () => {
    const http = {
      get: jest.fn(),
      post: jest.fn().mockReturnValue(of({ ok: true, releaseId: "release-1" })),
    } satisfies Pick<HttpClient, "get" | "post">;
    const serverConnection = createServerConnectionMock(null);
    const service = createService(http, serverConnection);

    await service.markReleaseRead("release-1");

    const storedClientId = localStorage.getItem("grayvale:changelog-client-id:v1");
    expect(http.post).toHaveBeenCalledWith(
      "/api/changelog/read",
      {
        releaseId: "release-1",
        clientId: storedClientId,
      },
      {
        withCredentials: true,
      },
    );
  });
});

function createService(
  http: Pick<HttpClient, "get" | "post">,
  serverConnection: Pick<ServerConnectionService, "session">,
): ChangelogService {
  TestBed.configureTestingModule({
    providers: [
      { provide: HttpClient, useValue: http },
      { provide: ServerConnectionService, useValue: serverConnection },
    ],
  });

  return TestBed.inject(ChangelogService);
}

function createServerConnectionMock(playerUuid: string | null) {
  return {
    session: signal(
      playerUuid
        ? ({
            playerUuid,
          } as { readonly playerUuid: string })
        : null,
    ),
  } as Pick<ServerConnectionService, "session">;
}
