import { Injectable, inject } from "@angular/core";
import { type NotificationPolicy } from "@rinner/grayvale-core";
import { firstValueFrom } from "rxjs";

import { NotificationPolicyLoader } from "../../data/loaders/notification-policy.loader";

@Injectable({ providedIn: "root" })
export class NotificationPolicyService {
  private readonly loader = inject(NotificationPolicyLoader);

  private policies: readonly NotificationPolicy[] = [];
  private loaded = false;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    this.policies = await firstValueFrom(this.loader.load());
    this.loaded = true;
  }

  async findPolicy(eventType: string): Promise<NotificationPolicy | null> {
    await this.ensureLoaded();
    return this.policies.find((entry) => entry.eventType === eventType) ?? null;
  }
}
