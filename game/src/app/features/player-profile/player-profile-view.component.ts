import { Component, input, output } from "@angular/core";

import type { CharacterCompatibilityStatus, PlayerProfileData } from "./player-profile-api.service";
import type { ServerProfile } from "../../core/services/server-profile.service";
import { PlayerCharacterCardComponent } from "./player-character-card.component";

@Component({
  selector: "gv-player-profile-view",
  standalone: true,
  imports: [PlayerCharacterCardComponent],
  templateUrl: "./player-profile-view.component.html",
  styleUrl: "./player-profile-view.component.scss",
})
export class PlayerProfileViewComponent {
  readonly profile = input<PlayerProfileData | null>(null);
  readonly serverProfile = input<ServerProfile | null>(null);
  readonly characterStatuses = input<readonly CharacterCompatibilityStatus[]>([]);
  readonly isLoading = input(false);
  readonly isCreating = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly createErrorMessage = input<string | null>(null);
  readonly newCharacterName = input("");

  readonly selectRequested = output<string>();
  readonly createRequested = output<string>();
  readonly newCharacterNameChanged = output<string>();

  protected onNameInput(event: Event): void {
    this.newCharacterNameChanged.emit((event.target as HTMLInputElement).value);
  }

  protected onCreateSubmit(): void {
    const name = this.newCharacterName().trim();
    if (name) {
      this.createRequested.emit(name);
    }
  }
}
