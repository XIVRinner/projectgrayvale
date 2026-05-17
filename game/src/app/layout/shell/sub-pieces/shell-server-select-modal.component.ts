import { Component, computed, input, output, signal } from "@angular/core";

import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";
import {
  DEFAULT_SERVER_CLIENT_ID,
  type ServerDirectoryEntry,
} from "../../../core/services/server-connection.service";
import type { ServerProfile } from "../../../core/services/server-profile.service";

@Component({
  selector: "gv-shell-server-select-modal",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-server-select-modal.component.html",
  styleUrl: "./shell-server-select-modal.component.scss",
})
export class ShellServerSelectModalComponent {
  readonly open = input.required<boolean>();
  readonly servers = input.required<readonly ServerDirectoryEntry[]>();
  readonly selectedServerId = input.required<string>();
  readonly activePlayerUuid = input<string | null>(null);
  readonly activeCharacterLabel = input<string | null>(null);
  readonly statusMessage = input<string | null>(null);
  readonly serverProfile = input<ServerProfile | null>(null);

  readonly closed = output<void>();
  readonly selectedServerChanged = output<string>();
  readonly serverAdded = output<{
    host: string;
    port: number;
    clientId: string;
  }>();
  readonly connectRequested = output<{ password: string }>();

  protected readonly host = signal("");
  protected readonly port = signal("3000");
  protected readonly clientId = signal(DEFAULT_SERVER_CLIENT_ID);
  protected readonly playerPassword = signal("");
  protected readonly isAddServerOpen = signal(false);

  protected readonly selectedServer = computed(
    () =>
      this.servers().find((entry) => entry.id === this.selectedServerId()) ??
      this.servers()[0] ??
      null,
  );

  protected readonly canConnect = computed(() =>
    Boolean(
      this.selectedServer() &&
        this.activePlayerUuid() &&
        this.playerPassword().trim(),
    ),
  );

  protected selectServer(serverId: string): void {
    this.selectedServerChanged.emit(serverId);
  }

  protected openAddServerDialog(): void {
    this.isAddServerOpen.set(true);
  }

  protected closeAddServerDialog(): void {
    this.isAddServerOpen.set(false);
  }

  protected onHostInput(event: Event): void {
    this.host.set((event.target as HTMLInputElement).value);
  }

  protected onPortInput(event: Event): void {
    this.port.set((event.target as HTMLInputElement).value);
  }

  protected onClientIdInput(event: Event): void {
    this.clientId.set((event.target as HTMLInputElement).value);
  }

  protected onPlayerPasswordInput(event: Event): void {
    this.playerPassword.set((event.target as HTMLInputElement).value);
  }

  protected addServer(): void {
    const host = this.host().trim();
    const clientId = this.clientId().trim();
    const port = Number(this.port());

    if (!host || !clientId || !Number.isInteger(port) || port <= 0) {
      return;
    }

    this.serverAdded.emit({ host, port, clientId });
    this.host.set("");
    this.isAddServerOpen.set(false);
  }

  protected connect(): void {
    if (!this.canConnect()) {
      return;
    }

    this.connectRequested.emit({
      password: this.playerPassword().trim(),
    });
    this.playerPassword.set("");
  }
}
