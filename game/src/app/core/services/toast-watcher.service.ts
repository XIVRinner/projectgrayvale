import { Injectable, inject } from "@angular/core";

import { DebugLogService } from "./game-log/debug-log.service";
import { GameplayLogService } from "./game-log/gameplay-log.service";
import { ToastEventsService } from "./toast-events.service";
import { ToastService } from "./toast.service";

@Injectable({ providedIn: "root" })
export class ToastWatcherService {
  private readonly toastEvents = inject(ToastEventsService);
  private readonly toasts = inject(ToastService);
  private readonly gameplayLog = inject(GameplayLogService);
  private readonly debugLog = inject(DebugLogService);

  constructor() {
    this.toastEvents.toastEvents$.subscribe((event) => {
      this.toasts.show(event.variant, event.payload);

      if (event.logEntry) {
        this.gameplayLog.appendManualEntry(event.logEntry);
      }

      this.debugLog.logMessage(
        event.debugScope ?? "toast",
        `Toast ${event.variant} queued: ${event.payload.title}`,
        event,
      );
    });
  }
}
