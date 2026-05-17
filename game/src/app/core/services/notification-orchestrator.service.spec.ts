import { TestBed } from "@angular/core/testing";

import { DebugLogService } from "./game-log/debug-log.service";
import { GameplayLogService } from "./game-log/gameplay-log.service";
import { NotificationOrchestratorService } from "./notification-orchestrator.service";
import { NotificationPolicyService } from "./notification-policy.service";
import { NotificationServerFanoutService } from "./notification-server-fanout.service";
import { ToastEventsService } from "./toast-events.service";

describe("NotificationOrchestratorService", () => {
  let service: NotificationOrchestratorService;
  let policyService: jasmine.SpyObj<NotificationPolicyService>;
  let toastEvents: jasmine.SpyObj<ToastEventsService>;
  let fanout: jasmine.SpyObj<NotificationServerFanoutService>;
  let gameplayLog: jasmine.SpyObj<GameplayLogService>;
  let debugLog: jasmine.SpyObj<DebugLogService>;

  beforeEach(() => {
    policyService = jasmine.createSpyObj<NotificationPolicyService>("NotificationPolicyService", ["findPolicy"]);
    toastEvents = jasmine.createSpyObj<ToastEventsService>("ToastEventsService", ["emit"]);
    fanout = jasmine.createSpyObj<NotificationServerFanoutService>("NotificationServerFanoutService", ["send"]);
    gameplayLog = jasmine.createSpyObj<GameplayLogService>("GameplayLogService", ["appendManualEntry"]);
    debugLog = jasmine.createSpyObj<DebugLogService>("DebugLogService", ["logMessage"]);

    TestBed.configureTestingModule({
      providers: [
        NotificationOrchestratorService,
        { provide: NotificationPolicyService, useValue: policyService },
        { provide: ToastEventsService, useValue: toastEvents },
        { provide: NotificationServerFanoutService, useValue: fanout },
        { provide: GameplayLogService, useValue: gameplayLog },
        { provide: DebugLogService, useValue: debugLog }
      ]
    });

    service = TestBed.inject(NotificationOrchestratorService);
  });

  it("routes toast + system chat + server fan-out for client-and-server policies", async () => {
    policyService.findPolicy.and.resolveTo({
      eventType: "achievement.earned",
      deliveryPolicy: "client-and-server",
      channels: ["toast", "system-chat"],
      audience: "global",
      toastVariant: "achievement-earned",
      chatTemplate: "{player} earned {achievement}",
      serverFanout: true
    });
    fanout.send.and.resolveTo();

    await service.route({
      eventType: "achievement.earned",
      actorName: "Aerin",
      achievementName: "dungeon-100-character"
    });

    expect(toastEvents.emit).toHaveBeenCalledTimes(1);
    expect(gameplayLog.appendManualEntry).toHaveBeenCalledWith({
      type: "system",
      text: "Aerin earned dungeon-100-character"
    });
    expect(fanout.send).toHaveBeenCalledTimes(1);
  });

  it("logs warning and does not fail player flow when server fan-out fails", async () => {
    policyService.findPolicy.and.resolveTo({
      eventType: "achievement.earned",
      deliveryPolicy: "client-and-server",
      channels: ["toast"],
      audience: "global",
      toastVariant: "achievement-earned",
      serverFanout: true
    });
    fanout.send.and.rejectWith(new Error("boom"));

    await service.route({ eventType: "achievement.earned" });

    expect(toastEvents.emit).toHaveBeenCalledTimes(1);
    expect(debugLog.logMessage).toHaveBeenCalledWith(
      "notification",
      "Notification server fan-out failed.",
      jasmine.any(Object),
      "warn"
    );
  });
});
