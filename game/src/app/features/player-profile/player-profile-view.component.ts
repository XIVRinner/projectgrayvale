import { Component, input, output } from "@angular/core";

import type { CharacterCompatibilityStatus, PlayerProfileData } from "./player-profile-api.service";
import type { ServerProfile } from "../../core/services/server-profile.service";
import { PlayerCharacterCardComponent } from "./player-character-card.component";

interface CharacterCardView {
  readonly status: CharacterCompatibilityStatus;
  readonly portraitSrc: string | null;
  readonly active: boolean;
  readonly createdOrder: number;
}

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
  readonly characterCards = input<readonly CharacterCardView[]>([]);
  readonly isLoading = input(false);
  readonly isSavingProfileName = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly profileNameErrorMessage = input<string | null>(null);
  readonly profileNameDraft = input("");

  readonly removeRequested = output<string>();
  readonly profileNameDraftChanged = output<string>();
  readonly profileNameSaveRequested = output<string>();

  protected onProfileNameInput(event: Event): void {
    this.profileNameDraftChanged.emit((event.target as HTMLInputElement).value);
  }

  protected onProfileNameSave(): void {
    const value = this.profileNameDraft().trim();

    if (value) {
      this.profileNameSaveRequested.emit(value);
    }
  }

  protected isSelectedCharacter(characterId: string): boolean {
    const profile = this.profile();
    return Boolean(
      profile && (profile.currentCharacterId === characterId || profile.activeCharacterId === characterId),
    );
  }

  protected canSaveProfileName(): boolean {
    const profile = this.profile();
    const draft = this.profileNameDraft().trim();

    if (!profile || !draft || this.isSavingProfileName()) {
      return false;
    }

    return draft !== (profile.displayName ?? "");
  }
}
