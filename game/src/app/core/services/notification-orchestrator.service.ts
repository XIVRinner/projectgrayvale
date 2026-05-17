import { Injectable, inject } from "@angular/core";
import { type GameLogEntry } from "./game-log/log-mapper";
import { DebugLogService } from "./game-log/debug-log.service";
import { GameplayLogService } from "./game-log/gameplay-log.service";
import { NotificationEventsService, type NotificationEventPayload } from "./notification-events.service";
import { NotificationPolicyService } from "./notification-policy.service";
import { NotificationServerFanoutService } from "./notification-server-fanout.service";
import { ToastEventsService } from "./toast-events.service";

@Injectable({ providedIn: "root" })
export class NotificationOrchestratorService {
  private readonly toastEvents = inject(ToastEventsService);
  private readonly policyService = inject(NotificationPolicyService);
  private readonly fanout = inject(NotificationServerFanoutService);
  private readonly gameplayLog = inject(GameplayLogService);
  private readonly debugLog = inject(DebugLogService);

  async route(event: NotificationEventPayload): Promise<void> {
    const policy = await this.policyService.findPolicy(event.eventType);

    if (!policy) {
      this.debugLog.logMessage("notification", `No notification policy for event type: ${event.eventType}`, event, "warn");
      return;
    }

    if (policy.channels.includes("toast") && policy.toastVariant) {
      this.toastEvents.emit({
        variant: policy.toastVariant,
        payload: {
          title: toTitle(event.eventType),
          message: event.message ?? formatChatMessage(policy.chatTemplate, event)
        }
      });
    }

    if (policy.channels.includes("system-chat")) {
      const entry: GameLogEntry = {
        type: "system",
        text: formatChatMessage(policy.chatTemplate, event)
      };
      this.gameplayLog.appendManualEntry(entry);
    }

    if (policy.deliveryPolicy === "client-and-server" && policy.serverFanout) {
      try {
        await this.fanout.send({
          eventType: event.eventType,
          audience: policy.audience,
          payload: {
            actorName: event.actorName,
            achievementName: event.achievementName,
            message: event.message
          }
        });
      } catch (error) {
        this.debugLog.logMessage("notification", "Notification server fan-out failed.", { event, error }, "warn");
      }
    }
  }
}

function formatChatMessage(template: string | undefined, event: NotificationEventPayload): string {
  const fallback = event.message ?? `Notification received: ${event.eventType}`;

  if (!template) {
    return fallback;
  }

  return template
    .replaceAll("{player}", event.actorName ?? "Unknown")
    .replaceAll("{achievement}", event.achievementName ?? "Unknown");
}

function toTitle(eventType: string): string {
  const [head] = eventType.split(".");
  if (!head) {
    return "Notification";
  }

  return `${head.charAt(0).toUpperCase()}${head.slice(1)}`;
}
