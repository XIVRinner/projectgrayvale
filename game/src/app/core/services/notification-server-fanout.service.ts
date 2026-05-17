import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { apiPath } from "../../data/api-paths";

export interface NotificationFanoutRequest {
  readonly eventType: string;
  readonly audience: "local" | "global";
  readonly payload: Record<string, unknown>;
}

@Injectable({ providedIn: "root" })
export class NotificationServerFanoutService {
  private readonly http = inject(HttpClient);
  private readonly failureCountState = signal(0);

  readonly failureCount = this.failureCountState.asReadonly();

  async send(request: NotificationFanoutRequest): Promise<void> {
    try {
      await firstValueFrom(this.http.post(apiPath("notifications/events"), request));
    } catch {
      this.failureCountState.update((value) => value + 1);
      throw new Error("Notification fan-out failed.");
    }
  }
}
