import { Component, input, output } from "@angular/core";

import type { CharacterCompatibilityStatus } from "./player-profile-api.service";

@Component({
  selector: "gv-player-character-card",
  standalone: true,
  template: `
    <div
      class="gv-char-card"
      [class.gv-char-card--incompatible]="!status().compatible"
      [attr.aria-disabled]="!status().compatible"
    >
      <div class="gv-char-card__body">
        <p class="gv-char-card__name">{{ status().character.name }}</p>
        <p class="gv-char-card__server">
          @if (status().character.contentBinding; as binding) {
            {{ binding.serverName }} &middot;
            <span class="gv-char-card__content-tag"
              [class.gv-char-card__content-tag--custom]="binding.customContent">
              {{ binding.customContent ? 'Custom' : 'Official' }}
            </span>
          } @else {
            <span class="gv-char-card__content-tag">Unbound</span>
          }
        </p>
        @if (!status().compatible) {
          <p class="gv-char-card__incompatible-reason">{{ status().reason }}</p>
        }
      </div>
      <button
        type="button"
        class="gv-char-card__select-btn"
        [disabled]="!status().compatible"
        (click)="selectRequested.emit(status().character.id)"
        [attr.title]="status().compatible ? 'Select character' : status().reason"
      >
        Select
      </button>
    </div>
  `,
  styleUrl: "./player-character-card.component.scss",
})
export class PlayerCharacterCardComponent {
  readonly status = input.required<CharacterCompatibilityStatus>();
  readonly selectRequested = output<string>();
}
