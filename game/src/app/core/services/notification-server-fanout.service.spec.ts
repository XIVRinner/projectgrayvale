import { HttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";

import { NotificationServerFanoutService } from "./notification-server-fanout.service";

describe("NotificationServerFanoutService", () => {
  let service: NotificationServerFanoutService;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>("HttpClient", ["post"]);

    TestBed.configureTestingModule({
      providers: [
        NotificationServerFanoutService,
        { provide: HttpClient, useValue: http }
      ]
    });

    service = TestBed.inject(NotificationServerFanoutService);
  });

  it("increments failure telemetry counter when fan-out fails", async () => {
    http.post.and.returnValue(throwError(() => new Error("network")));

    await expectAsync(
      service.send({
        eventType: "achievement.earned",
        audience: "global",
        payload: {}
      })
    ).toBeRejected();

    expect(service.failureCount()).toBe(1);
  });

  it("does not increment failure counter when fan-out succeeds", async () => {
    http.post.and.returnValue(of({ ok: true }));

    await service.send({
      eventType: "achievement.earned",
      audience: "global",
      payload: {}
    });

    expect(service.failureCount()).toBe(0);
  });
});
