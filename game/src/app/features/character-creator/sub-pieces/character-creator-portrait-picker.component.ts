import { Component, input, output } from "@angular/core";
import type { RaceVariant } from "@rinner/grayvale-core";

@Component({
  selector: "gv-character-creator-portrait-picker",
  templateUrl: "./character-creator-portrait-picker.component.html",
  styleUrl: "./character-creator-portrait-picker.component.scss"
})
export class CharacterCreatorPortraitPickerComponent {
  readonly availableVariants = input.required<readonly RaceVariant[]>();
  readonly selectedVariant = input.required<RaceVariant>();
  readonly availablePortraits = input.required<readonly string[]>();
  readonly selectedPortraitIndex = input.required<number>();
  readonly selectedPortraitSrc = input<string | null>(null);

  readonly variantChanged = output<RaceVariant>();
  readonly portraitChanged = output<number>();

  protected portraitSrcFor(index: number): string | null {
    const currentSrc = this.selectedPortraitSrc();
    const currentPortrait = this.availablePortraits()[this.selectedPortraitIndex()];
    const nextPortrait = this.availablePortraits()[index];

    if (!currentSrc || !currentPortrait || !nextPortrait) {
      return null;
    }

    return currentSrc.replace(currentPortrait, nextPortrait);
  }
}
