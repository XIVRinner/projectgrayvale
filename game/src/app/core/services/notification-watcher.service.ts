import { Injectable, inject } from "@angular/core";

import { NotificationEventsService } from "./notification-events.service";
import { NotificationOrchestratorService } from "./notification-orchestrator.service";

@Injectable({ providedIn: "root" })
export class NotificationWatcherService {
  private readonly events = inject(NotificationEventsService);
  private readonly orchestrator = inject(NotificationOrchestratorService);

  constructor() {
    this.events.events$.subscribe((event) => {
      void this.orchestrator.route(event);
    });
  }
}
