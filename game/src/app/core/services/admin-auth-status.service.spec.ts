import { HttpClient } from "@angular/common/http";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AdminAuthStatusService } from "./admin-auth-status.service";
import { ServerConnectionService } from "./server-connection.service";

describe("AdminAuthStatusService", () => {
  it("loads admin auth state from /api/auth/me using credentials", async () => {
    const http = {
      get: jest.fn(() =>
        of({
          authenticated: true,
          admin: true,
          username: "mark"
        })
      )
    } satisfies Pick<HttpClient, "get">;
    const serverConnection = {
      selectedServerId: signal("dev-local"),
      session: signal(null),
      serverApiUrl: jest.fn((path: `/api/${string}`) => path)
    } as unknown as Pick<ServerConnectionService, "selectedServerId" | "session" | "serverApiUrl">;

    await TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: ServerConnectionService, useValue: serverConnection }
      ]
    });

    const service = TestBed.inject(AdminAuthStatusService);

    await flushEffects();

    expect(http.get).toHaveBeenCalledWith("/api/auth/me", {
      withCredentials: true
    });
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(service.status()).toEqual({
      checked: true,
      authenticated: true,
      admin: true,
      username: "mark"
    });
    expect(service.canOpenKairosEdit()).toBe(true);
  });

  it("does not loop refreshes when auth status changes", async () => {
    const http = {
      get: jest.fn(() =>
        of({
          authenticated: true,
          admin: false,
          username: "mark"
        })
      )
    } satisfies Pick<HttpClient, "get">;
    const serverConnection = {
      selectedServerId: signal("dev-local"),
      session: signal(null),
      serverApiUrl: jest.fn((path: `/api/${string}`) => path)
    } as unknown as Pick<ServerConnectionService, "selectedServerId" | "session" | "serverApiUrl">;

    await TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: ServerConnectionService, useValue: serverConnection }
      ]
    });

    TestBed.inject(AdminAuthStatusService);

    await flushEffects();
    await flushEffects();

    expect(http.get).toHaveBeenCalledTimes(1);
  });
});

async function flushEffects(): Promise<void> {
  TestBed.flushEffects();
  await Promise.resolve();
  await Promise.resolve();
}
