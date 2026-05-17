import { Component, input, output } from "@angular/core";

import type { ServerDirectoryEntry } from "../../../core/services/server-connection.service";
import type { ServerProfile } from "../../../core/services/server-profile.service";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-server-join-confirmation",
  standalone: true,
  imports: [DialogShellComponent],
  templateUrl: "./shell-server-join-confirmation.component.html",
  styleUrl: "./shell-server-join-confirmation.component.scss",
})
export class ShellServerJoinConfirmationComponent {
  readonly open = input.required<boolean>();
  readonly server = input<ServerDirectoryEntry | null>(null);
  readonly serverProfile = input<ServerProfile | null>(null);
  readonly activePlayerUuid = input<string | null>(null);
  readonly activeCharacterLabel = input<string | null>(null);

  // GAP: Server dirty/modded public info
  // Blocked on: server API design
  // Needs: public /serverinfo endpoint exposing server flags such as modded, private, official, official modded, and dirty-risk messaging.
  // Do not implement until: the /serverinfo response shape is defined and wired into the server directory/profile layer.

  readonly closed = output<void>();
  readonly joinCurrentServerRequested = output<void>();
  readonly chooseDifferentServerRequested = output<void>();
  readonly stayOfflineRequested = output<void>();
}
