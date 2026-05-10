import { Component, computed, input, output, signal } from "@angular/core";

import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";
import type { ServerDirectoryEntry } from "../../../core/services/server-connection.service";

@Component({
  selector: "gv-shell-server-select-modal",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-server-select-modal.component.html",
  styleUrl: "./shell-server-select-modal.component.scss"
})
export class ShellServerSelectModalComponent {
  readonly open = input.required<boolean>();
  readonly servers = input.required<readonly ServerDirectoryEntry[]>();
  readonly selectedServerId = input.required<string>();
  readonly activePlayerUuid = input<string | null>(null);
  readonly statusMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly selectedServerChanged = output<string>();
  readonly serverAdded = output<{ host: string; port: number; clientId: string }>();
  readonly connectRequested = output<{ password: string }>();
  readonly giveAdminRequested = output<{ adminPassword: string }>();

  protected readonly host = signal("");
  protected readonly port = signal("3000");
  protected readonly clientId = signal("grayvale-local-client");
  protected readonly playerPassword = signal("");
  protected readonly adminPassword = signal("");

  protected readonly selectedServer = computed(
    () => this.servers().find((entry) => entry.id === this.selectedServerId()) ?? this.servers()[0] ?? null
  );

  protected onSelectedServerChanged(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedServerChanged.emit(target.value);
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

  protected onAdminPasswordInput(event: Event): void {
    this.adminPassword.set((event.target as HTMLInputElement).value);
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
  }

  protected connect(): void {
    this.connectRequested.emit({
      password: this.playerPassword().trim()
    });
    this.playerPassword.set("");
  }

  protected giveAdminRights(): void {
    this.giveAdminRequested.emit({
      adminPassword: this.adminPassword().trim()
    });
    this.adminPassword.set("");
  }
}
