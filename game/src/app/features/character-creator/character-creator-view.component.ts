import { Component, input, output } from "@angular/core";
import type { PlayerDifficultyMode, RaceVariant } from "@rinner/grayvale-core";

import { CharacterCreatorViewState } from "./character-creator.types";
import { CharacterCreatorClassCardComponent } from "./sub-pieces/character-creator-class-card.component";
import { CharacterCreatorPortraitPickerComponent } from "./sub-pieces/character-creator-portrait-picker.component";
import { CharacterCreatorRaceCardComponent } from "./sub-pieces/character-creator-race-card.component";

@Component({
  selector: "gv-character-creator-view",
  imports: [
    CharacterCreatorRaceCardComponent,
    CharacterCreatorClassCardComponent,
    CharacterCreatorPortraitPickerComponent
  ],
  templateUrl: "./character-creator-view.component.html",
  styleUrl: "./character-creator-view.component.scss"
})
export class CharacterCreatorViewComponent {
  protected readonly difficultyModes: readonly PlayerDifficultyMode[] = ["easy", "normal", "hard"];

  readonly state = input.required<CharacterCreatorViewState>();
  readonly presentation = input<"page" | "dialog">("page");

  readonly nameChanged = output<string>();
  readonly genderChanged = output<string>();
  readonly raceChanged = output<string>();
  readonly classChanged = output<string>();
  readonly variantChanged = output<RaceVariant>();
  readonly portraitChanged = output<number>();
  readonly difficultyModeChanged = output<PlayerDifficultyMode>();
  readonly expertModeChanged = output<boolean>();
  readonly ironmanModeChanged = output<boolean>();
  readonly nameRandomizeRequested = output<void>();
  readonly randomizeRequested = output<void>();
  readonly createRequested = output<void>();

  protected onNameInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.nameChanged.emit(target.value);
  }

  protected formatPreview(player: CharacterCreatorViewState["previewPlayer"]): string {
    if (!player) {
      return "{}";
    }

    return JSON.stringify(player, null, 2);
  }

  protected onExpertModeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.expertModeChanged.emit(target.checked);
  }

  protected onIronmanModeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.ironmanModeChanged.emit(target.checked);
  }
}
