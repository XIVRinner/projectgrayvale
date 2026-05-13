import { HttpClient } from "@angular/common/http";
import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";

export interface AdminAuthStatusView {
  readonly checked: boolean;
  readonly authenticated: boolean;
  readonly admin: boolean;
  readonly username: string | null;
}

interface AuthMeResponse {
  readonly authenticated: boolean;
  readonly admin: boolean;
  readonly username?: string;
}

const DEFAULT_STATUS: AdminAuthStatusView = {
  checked: false,
  authenticated: false,
  admin: false,
  username: null
};

@Injectable({ providedIn: "root" })
export class AdminAuthStatusService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);
  private readonly statusState = signal<AdminAuthStatusView>(DEFAULT_STATUS);
  private requestGeneration = 0;
  private refreshQueued = false;

  readonly status = this.statusState.asReadonly();
  readonly canOpenKairosEdit = computed(
    () => this.statusState().checked && this.statusState().authenticated && this.statusState().admin
  );

  constructor() {
    effect(() => {
      this.serverConnection.selectedServerId();
      this.serverConnection.session();
      this.queueRefresh();
    });
  }

  async refresh(): Promise<void> {
    const generation = ++this.requestGeneration;

    // Only reset to unchecked on the very first check so that
    // subsequent session refreshes never briefly close dialogs that
    // require admin auth (canOpenKairosEdit flickering to false).
    if (!this.statusState().checked) {
      this.statusState.set(DEFAULT_STATUS);
    }

    try {
      const response = await firstValueFrom(
        this.http.get<AuthMeResponse>(this.serverConnection.serverApiUrl("/api/auth/me"), {
          withCredentials: true
        })
      );

      if (generation !== this.requestGeneration) {
        return;
      }

      this.statusState.set({
        checked: true,
        authenticated: response.authenticated,
        admin: response.authenticated && response.admin,
        username:
          response.authenticated && typeof response.username === "string" && response.username.trim().length > 0
            ? response.username
            : null
      });
    } catch {
      if (generation !== this.requestGeneration) {
        return;
      }

      this.statusState.set({ ...DEFAULT_STATUS, checked: true });
    }
  }

  private queueRefresh(): void {
    if (this.refreshQueued) {
      return;
    }

    this.refreshQueued = true;
    queueMicrotask(() => {
      this.refreshQueued = false;
      void this.refresh();
    });
  }
}
